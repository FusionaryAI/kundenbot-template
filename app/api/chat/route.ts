import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

type RagMatch = {
  id: string;
  content: string;
  similarity: number;
};

type TenantSettings = {
  welcome_message: string;
  fallback_message: string;
  // optional für Leads (falls du Spalten schon ergänzt hast)
  lead_enabled?: boolean | null;
  lead_email?: string | null;
  lead_auto_reply?: string | null;
};

type LeadType = "contact" | "appointment" | "callback";

type HandoffState = {
  active: boolean;
  stage?: "offered" | "collect_name" | "collect_contact" | "collect_message" | "ready";
  lead_type?: LeadType;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  // Guard
  offered_at_ts?: number;
  completed?: boolean;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Soft-Threshold (nur als Orientierung). Wir fallen nicht mehr hart zurück,
// solange wir überhaupt Matches haben.
const MIN_SIMILARITY = 0.20;

// --- Fetch Tenant ---
async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("getTenantBySlug error:", error, "for slug:", slug);
    throw new Error("Tenant not found");
  }

  return data;
}

// --- Fetch Tenant Settings ---
async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  // Wir erweitern SELECT, aber bleiben kompatibel, falls Spalten (noch) fehlen:
  // Wenn deine tenant_settings diese Spalten noch nicht hat, bekommst du in Supabase einen Fehler.
  // Dann kommentieren wir die Felder wieder raus ODER du fügst die Spalten an (empfohlen).
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("welcome_message, fallback_message, lead_enabled, lead_email, lead_auto_reply")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    console.warn(
      "tenant_settings not found for tenant_id:",
      tenantId,
      "— using defaults",
    );
    return {
      welcome_message: "Wie kann ich Ihnen helfen?",
      fallback_message:
        "Leider habe ich hierzu noch keine Informationen hinterlegt.",
      lead_enabled: true,
      lead_email: null,
      lead_auto_reply: "Vielen Dank! Wir haben Ihre Anfrage erhalten und melden uns zeitnah.",
    };
  }

  return data as TenantSettings;
}

// --- Vector RAG Search ---
async function ragSearch(
  tenantId: string,
  query: string,
  k = 4,
): Promise<RagMatch[]> {
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const queryEmbedding = emb.data[0].embedding;

  const { data, error } = await supaAdmin.rpc("match_embeddings", {
    query_embedding: queryEmbedding,
    match_count: k,
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error("match_embeddings error:", error);
    throw new Error("Vector search failed");
  }

  return (data ?? []) as RagMatch[];
}

// --- System Prompt (neutral, für alle Branchen) ---
function systemPrompt(companyName: string, fallbackMessage: string) {
  return `Rolle:
Du bist ein professioneller digitaler Assistent des Unternehmens "${companyName}".

REGELN:
- Antworte klar, höflich und direkt auf die Frage.
- Keine frei erfundenen Informationen.
- Wenn etwas nicht bekannt ist oder im Unternehmenswissen nicht vorkommt: Nutze sinngemäß: "${fallbackMessage}".
- Verwende kurze Absätze.
- Listen nur, wenn sinnvoll (max. 5–7 Punkte).
- Keine Begrüßung, kein Smalltalk, keine Abschlussfloskeln.

ZIEL:
Hilf der anfragenden Person schnell und zuverlässig mit Informationen des Unternehmens weiter.`;
}

/* --------------------------
   Lead/Handoff Helpers
--------------------------- */

function normalizeHandoff(h: any): HandoffState {
  return {
    active: !!h?.active,
    stage: h?.stage,
    lead_type: h?.lead_type,
    name: h?.name,
    email: h?.email,
    phone: h?.phone,
    message: h?.message,
    offered_at_ts: h?.offered_at_ts,
    completed: !!h?.completed,
  };
}

function userSaysYes(text: string) {
  const t = text.trim().toLowerCase();
  return (
    t === "ja" ||
    t.startsWith("ja ") ||
    t.startsWith("ja,") ||
    t.includes("gerne") ||
    t.includes("bitte") ||
    t === "ok" ||
    t === "okay"
  );
}

function userSaysNo(text: string) {
  const t = text.trim().toLowerCase();
  return t === "nein" || t.startsWith("nein ") || t.startsWith("nein,");
}

function extractBasicsFromText(text: string) {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0];

  const phoneMatch = text.match(/(\+?\d[\d\s().-]{6,}\d)/);
  const phone = phoneMatch?.[0];

  let name: string | undefined;
  const nameMatch =
    text.match(/(ich heiße|mein name ist|name:)\s*([A-Za-zÀ-ÿ' -]{2,})/i) ||
    text.match(/^(?:name)\s*[:\-]\s*([A-Za-zÀ-ÿ' -]{2,})$/im);
  if (nameMatch) name = (nameMatch[2] || nameMatch[1])?.trim();

  return { email, phone, name };
}

async function classifyLeadIntent(userText: string) {
  const prompt = `
Analysiere die Nutzeranfrage und entscheide:
- offer_handoff: soll aktiv angeboten werden, eine Anfrage aufzunehmen?
- lead_type: appointment, callback oder contact
Gib NUR gültiges JSON zurück.

Regeln:
- Terminwörter ("Termin", "vereinbaren", "Sprechstunde", "Beratungstermin") => appointment
- Rückrufwörter ("Rückruf", "anrufen", "zurückrufen") => callback
- Interesse/Anfrage ("Kontakt", "Anfrage", "Interesse", "Preise", "Angebot") => contact
Text:
"""${userText}"""
`;
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const raw = resp.choices[0]?.message?.content?.trim() || "{}";
  try {
    const obj = JSON.parse(raw);
    const offer_handoff = !!obj.offer_handoff;
    const lt = obj.lead_type as string | undefined;
    const lead_type: LeadType =
      lt === "appointment" || lt === "callback" || lt === "contact"
        ? lt
        : "contact";
    return { offer_handoff, lead_type };
  } catch {
    return { offer_handoff: false, lead_type: "contact" as LeadType };
  }
}

async function sendLeadViaApi(slug: string, lead: { type: LeadType; name?: string; email?: string; phone?: string; message: string; metadata?: any }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      type: lead.type,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      message: lead.message,
      metadata: lead.metadata ?? { source: "chat" },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Lead delivery failed");
  }
  return json as { ok: true; lead_id: string; message: string };
}

/* --------------------------
   Haupt-Handler (POST)
--------------------------- */

export async function POST(req: NextRequest) {
  try {
    // Body lesen
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const url = new URL(req.url);

    const message =
      (body.message as string | undefined) ??
      url.searchParams.get("message") ??
      "";

    const slug =
      (body.slug as string | undefined) ??
      url.searchParams.get("slug") ??
      req.headers.get("x-tenant-slug") ??
      undefined;

    // NEW: handoff state
    let handoff = normalizeHandoff(body.handoff);

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    if (!slug) {
      console.error("[API] Missing slug in request");
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    console.log("[API] Incoming request", {
      slug,
      messagePreview: message.slice(0, 80),
    });

    // Tenant + Settings laden
    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    // Guard: wenn completed, normal weiter
    if (handoff.completed) {
      handoff = { active: false, completed: true };
    }

    /* ---------------------------------------
       1) Lead Flow (läuft VOR RAG/LLM)
       - minimal-invasiv: nur wenn handoff.active
    ---------------------------------------- */

    if (handoff.active && !handoff.completed) {
      // Abbruch
      if (userSaysNo(message)) {
        handoff = { active: false, completed: false };
        return NextResponse.json({
          text: "Alles klar. Wobei kann ich Ihnen sonst helfen?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      const extracted = extractBasicsFromText(message);
      if (!handoff.name && extracted.name) handoff.name = extracted.name;
      if (!handoff.email && extracted.email) handoff.email = extracted.email;
      if (!handoff.phone && extracted.phone) handoff.phone = extracted.phone;

      // Anliegen/Message einsammeln
      if (!handoff.message) {
        if (!userSaysYes(message) && message.trim().length > 2) {
          handoff.message = message.trim();
        }
      } else {
        if (!userSaysYes(message) && message.trim().length > 2) {
          handoff.message = `${handoff.message}\n\nZusatz: ${message.trim()}`.trim();
        }
      }

      // Missing?
      const missing: Array<"name" | "contact" | "message"> = [];
      if (!handoff.name) missing.push("name");
      if (!handoff.email && !handoff.phone) missing.push("contact");
      if (!handoff.message) missing.push("message");

      // stagebasierte Rückfragen
      if (missing.includes("name")) {
        handoff.stage = "collect_name";
        return NextResponse.json({
          text: "Gerne. Wie ist Ihr Name?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      if (missing.includes("contact")) {
        handoff.stage = "collect_contact";
        return NextResponse.json({
          text: "Danke. Wie können wir Sie am besten erreichen – per E-Mail oder Telefon?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      if (missing.includes("message")) {
        handoff.stage = "collect_message";
        const t = handoff.lead_type ?? "contact";
        const ask =
          t === "appointment"
            ? "Worum geht es bei dem Termin (kurz) und wann würde es Ihnen ungefähr passen?"
            : t === "callback"
            ? "Worum geht es und wann sollen wir Sie am besten zurückrufen?"
            : "Worum geht es genau? Bitte kurz schildern.";
        return NextResponse.json({
          text: ask,
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      // Wenn Leads deaktiviert oder kein Empfänger gesetzt
      if (settings.lead_enabled === false || !settings.lead_email) {
        const fallback =
          settings.fallback_message ||
          "Ich kann Ihre Anfrage aktuell nicht weiterleiten. Bitte kontaktieren Sie uns direkt über die Website oder telefonisch.";
        handoff = { active: false, completed: false };
        return NextResponse.json({
          text: fallback,
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      // Lead absenden
      const leadType: LeadType = handoff.lead_type || "contact";
      const leadMessage = handoff.message || message || "Kontaktanfrage";

      const result = await sendLeadViaApi(slug, {
        type: leadType,
        name: handoff.name,
        email: handoff.email,
        phone: handoff.phone,
        message: leadMessage,
        metadata: { source: "chat", lead_type: leadType },
      });

      handoff.completed = true;
      handoff.active = false;
      handoff.stage = "ready";

      return NextResponse.json({
        text: result.message || settings.lead_auto_reply || "Vielen Dank! Wir melden uns zeitnah.",
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    /* ---------------------------------------
       2) Optionales aktives Angebot (professionell)
       - nur wenn leads enabled
       - guard gegen Spam: max alle 2 Minuten
    ---------------------------------------- */
    const now = Date.now();
    const offeredRecently =
      typeof handoff.offered_at_ts === "number" && now - handoff.offered_at_ts < 120_000;

    if (
      (settings.lead_enabled !== false) &&
      !offeredRecently &&
      !handoff.completed
    ) {
      const { offer_handoff, lead_type } = await classifyLeadIntent(message);

      if (offer_handoff) {
        handoff = {
          active: false,
          completed: false,
          stage: "offered",
          lead_type,
          offered_at_ts: now,
        };

        const offerText =
          lead_type === "appointment"
            ? "Möchten Sie, dass ich eine Terminanfrage ans Team weiterleite? Dann nehme ich kurz Ihre Kontaktdaten und den Terminwunsch auf."
            : lead_type === "callback"
            ? "Möchten Sie, dass ich eine Rückrufbitte ans Team weiterleite? Dann nehme ich kurz Ihre Kontaktdaten und das Thema auf."
            : "Möchten Sie, dass ich Ihre Anfrage direkt ans Team weiterleite? Dann nehme ich kurz Ihre Kontaktdaten auf.";

        return NextResponse.json({
          text: offerText,
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }
    }

    /* ---------------------------------------
       3) Wenn Nutzer auf Angebot mit "Ja" reagiert,
          starten wir den handoff flow
    ---------------------------------------- */
    if (handoff.stage === "offered" && userSaysYes(message)) {
      handoff.active = true;
      handoff.stage = "collect_name";
      return NextResponse.json({
        text: "Super. Wie ist Ihr Name?",
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    // --- RAG / Wissenssuche ---
    let matches: RagMatch[] = [];
    try {
      matches = await ragSearch(tenant.id, message, 4);
      console.log(
        "[RAG] raw matches:",
        matches.map((m) => ({ id: m.id, similarity: m.similarity })),
      );
    } catch (e) {
      console.error("[RAG] error while calling match_embeddings:", e);
      matches = [];
    }

    // Nur sinnvolle Matches behalten
    const scored = (matches ?? []).filter(
      (m) =>
        typeof m.similarity === "number" &&
        !!m.content &&
        m.content.trim().length > 0,
    );

    // Debug-Mode: ?debug=1 gibt Rohdaten zurück
    const debug = url.searchParams.get("debug");
    if (debug === "1") {
      const relevantMatches = scored.filter((m) => m.similarity >= MIN_SIMILARITY);
      return NextResponse.json({
        slug,
        tenant,
        settings,
        matches: scored,
        relevantMatches,
        threshold: MIN_SIMILARITY,
      });
    }

    // Wenn wirklich gar keine Matches aus der DB kommen ⇒ Fallback
    if (scored.length === 0) {
      console.log("[RAG] no matches returned from vector search, using fallback_message");
      return NextResponse.json({
        text: settings.fallback_message,
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    // Soft-Filter: bevorzugt >= Threshold, sonst Top-K (damit Demo nicht “stumm” wird)
    const above = scored
      .filter((m) => m.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity);

    const top = (above.length > 0 ? above : scored)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    console.log("[RAG] using matches for KB:", {
      usedCount: top.length,
      threshold: MIN_SIMILARITY,
      usedSimilarities: top.map((m) => m.similarity),
      usedIds: top.map((m) => m.id),
    });

    const kb = top.map((m) => `- ${m.content}`).join("\n");
    const system = systemPrompt(tenant.name, settings.fallback_message);

    // --- LLM-Antwort generieren ---
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Nutzerfrage:
"""${message}"""

Unternehmenswissen:
${kb}

Bitte antworte strukturiert, sachlich, hilfreich und ohne Begrüßung.`,
        },
      ],
    });

    const text =
      completion.choices[0]?.message?.content ?? settings.fallback_message;

    return NextResponse.json({
      text,
      welcome_message: settings.welcome_message,
      from_kb: true,
      handoff,
    });
  } catch (e: any) {
    console.error("API ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 },
    );
  }
}