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

  offered_at_ts?: number;
  completed?: boolean;

  preferred_contact?: "email" | "phone";
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Soft-Threshold (nur als Orientierung). Wir fallen nicht mehr hart zurück,
// solange wir überhaupt Matches haben.
const MIN_SIMILARITY = 0.20;

// --------------------
// DB Helpers
// --------------------

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

async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("welcome_message, fallback_message, lead_enabled, lead_email, lead_auto_reply")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    return {
      welcome_message: "Wie kann ich Ihnen helfen?",
      fallback_message: "Leider habe ich hierzu noch keine Informationen hinterlegt.",
      lead_enabled: true,
      lead_email: null,
      lead_auto_reply: "Vielen Dank! Wir melden uns zeitnah.",
    };
  }

  return data as TenantSettings;
}

// --------------------
// RAG
// --------------------

async function ragSearch(tenantId: string, query: string, k = 4): Promise<RagMatch[]> {
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

// --------------------
// Handoff Utils
// --------------------

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
    preferred_contact: h?.preferred_contact,
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

function extractEmail(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0];
}

function extractPhone(text: string) {
  const m = text.match(/(\+?\d[\d\s().-]{6,}\d)/);
  return m?.[0];
}

function normalizeNameCandidate(text: string) {
  return text
    .trim()
    .replace(/^(ich heiße|mein name ist|name:)\s*/i, "")
    .replace(/^(herr|frau|dr\.?|prof\.?)\s+/i, "")
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// sehr tolerant: akzeptiert auch "Max Mustermann." usw.
function looksLikeFullName(text: string) {
  const t = normalizeNameCandidate(text);
  if (t.length < 3 || t.length > 80) return false;
  if (extractEmail(t) || extractPhone(t)) return false;

  // entferne "(...)" am Ende optional
  const cleaned = t.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;

  return parts.every((p) => /^[A-Za-zÀ-ÿ'’\-]+$/.test(p));
}

function looksLikeSingleNamePart(text: string) {
  const t = normalizeNameCandidate(text);
  if (t.length < 2 || t.length > 40) return false;
  if (extractEmail(t) || extractPhone(t)) return false;

  const cleaned = t.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length !== 1) return false;

  return /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(parts[0]);
}

/**
 * Rule-First Intent Detection (deterministisch)
 */
function detectLeadIntentRuleFirst(userText: string): LeadType | null {
  const t = userText.toLowerCase();

  const appointmentKeywords = [
    "termin",
    "termine",
    "terminvereinbarung",
    "vereinbaren",
    "beratungstermin",
    "sprechstunde",
    "reservieren",
    "buch",
    "buchen",
    "kalender",
    "slot",
  ];

  const callbackKeywords = [
    "rückruf",
    "zurückrufen",
    "rufen sie mich",
    "ruf mich",
    "anrufen",
    "telefonieren",
    "call",
    "callback",
  ];

  const contactKeywords = [
    "kontakt",
    "anfrage",
    "angebot",
    "preise",
    "kosten",
    "interesse",
    "beratung",
    "info",
    "information",
    "email",
    "e-mail",
  ];

  if (appointmentKeywords.some((k) => t.includes(k))) return "appointment";
  if (callbackKeywords.some((k) => t.includes(k))) return "callback";
  if (contactKeywords.some((k) => t.includes(k))) return "contact";

  return null;
}

async function classifyLeadIntentLLM(userText: string) {
  const prompt = `
Analysiere die Nutzeranfrage und entscheide:
- offer_handoff: soll aktiv angeboten werden, eine Anfrage aufzunehmen?
- lead_type: appointment, callback oder contact
Gib NUR gültiges JSON zurück.

Regeln:
- Terminwörter => appointment
- Rückrufwörter => callback
- Interesse/Anfrage => contact

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
      lt === "appointment" || lt === "callback" || lt === "contact" ? lt : "contact";
    return { offer_handoff, lead_type };
  } catch {
    return { offer_handoff: false, lead_type: "contact" as LeadType };
  }
}

/**
 * LLM-Extraktion (Fallback) – stage-basiert.
 * Wird nur genutzt, wenn Heuristiken nicht ausreichen.
 * Rückgabe muss validiert werden.
 */
async function extractWithLLM(
  stage: "collect_name" | "collect_contact" | "collect_message",
  userText: string,
) {
  const instructionByStage =
    stage === "collect_name"
      ? `Extrahiere einen plausiblen vollständigen Namen (Vor- und Nachname), falls vorhanden.`
      : stage === "collect_contact"
        ? `Extrahiere E-Mail und/oder Telefonnummer, falls vorhanden. Erkenne ggf. preferred_contact ("email" oder "phone") wenn Nutzer das sagt.`
        : `Extrahiere das Anliegen als message (kurz, aber vollständig).`;

  const prompt = `
Du bist ein Parser. ${instructionByStage}

Gib ausschließlich JSON im folgenden Schema zurück:
{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "preferred_contact": "email" | "phone" | null,
  "message": string | null
}

Text:
"""${userText}"""
`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = resp.choices[0]?.message?.content?.trim() || "{}";
  try {
    const obj = JSON.parse(raw);
    return {
      name: typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : null,
      email: typeof obj.email === "string" && obj.email.trim() ? obj.email.trim() : null,
      phone: typeof obj.phone === "string" && obj.phone.trim() ? obj.phone.trim() : null,
      preferred_contact:
        obj.preferred_contact === "email" || obj.preferred_contact === "phone"
          ? obj.preferred_contact
          : null,
      message: typeof obj.message === "string" && obj.message.trim() ? obj.message.trim() : null,
    };
  } catch {
    return { name: null, email: null, phone: null, preferred_contact: null, message: null };
  }
}

// --------------------
// Leads API Call
// --------------------

async function sendLeadViaApi(
  slug: string,
  lead: {
    type: LeadType;
    name?: string;
    email?: string;
    phone?: string;
    message: string;
    metadata?: any;
  },
) {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const url = base ? `${base}/api/leads` : `/api/leads`;

  const res = await fetch(url, {
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
  return json as { ok: true; lead_id: string; email_sent?: boolean; message: string };
}

// --------------------
// Handler
// --------------------

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const url = new URL(req.url);

    const message =
      (body.message as string | undefined) ?? url.searchParams.get("message") ?? "";

    const slug =
      (body.slug as string | undefined) ??
      url.searchParams.get("slug") ??
      req.headers.get("x-tenant-slug") ??
      undefined;

    let handoff = normalizeHandoff(body.handoff);

    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    const debugMode = url.searchParams.get("debug") === "1";

    if (handoff.completed) {
      handoff = { active: false, completed: true };
    }

    // 0) Offer offen + Ja/Nein
    if (handoff.stage === "offered" && !handoff.active && !handoff.completed) {
      if (userSaysNo(message)) {
        handoff = { active: false, completed: false };
        return NextResponse.json({
          text: "Alles klar. Wobei kann ich Ihnen sonst helfen?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }
      if (userSaysYes(message)) {
        handoff.active = true;
        handoff.stage = "collect_name";
        return NextResponse.json({
          text: "Super. Wie ist Ihr Name?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }
      // sonst normal weiter
    }

    // 1) Handoff aktiv: stage-basiert sammeln (mit LLM-Fallback)
    if (handoff.active && !handoff.completed) {
      if (userSaysNo(message)) {
        handoff = { active: false, completed: false };
        return NextResponse.json({
          text: "Alles klar. Wobei kann ich Ihnen sonst helfen?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      const raw = message.trim();
      const lower = raw.toLowerCase();

      // 1a) Name sammeln (robust: tolerant + gezielte Nachname-Rückfrage)
      if (!handoff.name && handoff.stage === "collect_name") {
        // wenn User aus Versehen E-Mail/Telefon sendet
        if (extractEmail(raw) || extractPhone(raw)) {
          return NextResponse.json({
            text: "Danke. Bitte nennen Sie mir Ihren Namen (Vor- und Nachname).",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }

        // Vollname?
        if (looksLikeFullName(raw)) {
          handoff.name = normalizeNameCandidate(raw).replace(/\s*\([^)]*\)\s*$/g, "").trim();
          handoff.stage = "collect_contact";
          return NextResponse.json({
            text: "Danke. Wie können wir Sie am besten erreichen – per E-Mail oder Telefon?",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }

        // Nur Vorname? -> gezielt Nachname erfragen, aber Vorname merken
        if (looksLikeSingleNamePart(raw)) {
          handoff.name = normalizeNameCandidate(raw).split(/\s+/)[0]; // Vorname
          // Bleibt im collect_name – aber Frage ist anders
          return NextResponse.json({
            text: "Danke. Können Sie mir bitte noch Ihren Nachnamen nennen?",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff: { ...handoff, stage: "collect_name" },
          });
        }

        // Wenn schon Vorname gespeichert ist (aus vorigem Schritt) und User sendet Nachname
        // (z.B. Bot fragte nach Nachnamen, User antwortet "Mustermann.")
        if (handoff.name && handoff.name.split(/\s+/).length === 1) {
          const lastCandidate = normalizeNameCandidate(raw).replace(/\s*\([^)]*\)\s*$/g, "").trim();
          const okLast = /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(lastCandidate);
          if (okLast) {
            handoff.name = `${handoff.name} ${lastCandidate}`.trim();
            handoff.stage = "collect_contact";
            return NextResponse.json({
              text: "Danke. Wie können wir Sie am besten erreichen – per E-Mail oder Telefon?",
              welcome_message: settings.welcome_message,
              from_kb: false,
              handoff,
            });
          }
        }

        // LLM-Fallback: extrahiere Name
        const llm = await extractWithLLM("collect_name", raw);
        if (llm.name && looksLikeFullName(llm.name)) {
          handoff.name = normalizeNameCandidate(llm.name).replace(/\s*\([^)]*\)\s*$/g, "").trim();
          handoff.stage = "collect_contact";
          return NextResponse.json({
            text: "Danke. Wie können wir Sie am besten erreichen – per E-Mail oder Telefon?",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }

        return NextResponse.json({
          text: "Wie ist Ihr vollständiger Name? (Vor- und Nachname, z. B. „Max Mustermann“)",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      // 1b) Kontakt sammeln
      if ((!handoff.email && !handoff.phone) && handoff.stage === "collect_contact") {
        // Preference erkennen (heuristisch)
        if (lower.includes("telefon")) handoff.preferred_contact = "phone";
        if (lower.includes("mail") || lower.includes("e-mail") || lower.includes("email"))
          handoff.preferred_contact = "email";

        // E-Mail/Telefon heuristisch extrahieren
        const email = extractEmail(raw);
        const phone = extractPhone(raw);
        if (email) handoff.email = email;
        if (phone) handoff.phone = phone;

        // Falls noch nichts: LLM-Fallback
        if (!handoff.email && !handoff.phone) {
          const llm = await extractWithLLM("collect_contact", raw);

          if (llm.preferred_contact) handoff.preferred_contact = llm.preferred_contact;

          // Validierung beibehalten
          if (llm.email && extractEmail(llm.email)) handoff.email = extractEmail(llm.email);
          if (llm.phone && extractPhone(llm.phone)) handoff.phone = extractPhone(llm.phone);
        }

        // Wenn User nur "per Telefon" sagt, fragen wir gezielt nach Nummer
        if (!handoff.email && !handoff.phone) {
          if (handoff.preferred_contact === "phone") {
            return NextResponse.json({
              text: "Alles klar. Wie lautet Ihre Telefonnummer?",
              welcome_message: settings.welcome_message,
              from_kb: false,
              handoff,
            });
          }
          if (handoff.preferred_contact === "email") {
            return NextResponse.json({
              text: "Alles klar. Wie lautet Ihre E-Mail-Adresse?",
              welcome_message: settings.welcome_message,
              from_kb: false,
              handoff,
            });
          }

          return NextResponse.json({
            text: "Bitte senden Sie mir Ihre E-Mail-Adresse oder Telefonnummer (z. B. max@mail.de oder +49...).",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }

        // Kontakt vorhanden -> nächster Schritt: Anliegen
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

      // 1c) Anliegen sammeln
      if (!handoff.message && handoff.stage === "collect_message") {
        if (raw.length >= 3) {
          handoff.message = raw;
        } else {
          const llm = await extractWithLLM("collect_message", raw);
          if (llm.message && llm.message.length >= 3) handoff.message = llm.message;
        }

        if (!handoff.message) {
          return NextResponse.json({
            text: "Bitte schildern Sie kurz Ihr Anliegen.",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }
      } else if (handoff.message && handoff.stage === "collect_message") {
        if (raw.length >= 3) {
          handoff.message = `${handoff.message}\n\nZusatz: ${raw}`.trim();
        }
      }

      // Guard: Leads aktiviert + Empfänger gesetzt?
      if (settings.lead_enabled === false || !settings.lead_email) {
        handoff = { active: false, completed: false };
        return NextResponse.json({
          text: settings.fallback_message,
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      // Lead absenden
      const leadType: LeadType = handoff.lead_type || "contact";
      const leadMessage = handoff.message || "Kontaktanfrage";

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

    // 2) RULE-FIRST Offer
    const ruleLeadType = detectLeadIntentRuleFirst(message);

    const now = Date.now();
    const offeredRecently =
      typeof handoff.offered_at_ts === "number" && now - handoff.offered_at_ts < 120_000;

    if (ruleLeadType && settings.lead_enabled !== false && !offeredRecently && !handoff.completed) {
      handoff = {
        active: false,
        completed: false,
        stage: "offered",
        lead_type: ruleLeadType,
        offered_at_ts: now,
      };

      const offerText =
        ruleLeadType === "appointment"
          ? "Möchten Sie, dass ich eine Terminanfrage ans Team weiterleite? Dann nehme ich kurz Ihre Kontaktdaten und den Terminwunsch auf."
          : ruleLeadType === "callback"
            ? "Möchten Sie, dass ich eine Rückrufbitte ans Team weiterleite? Dann nehme ich kurz Ihre Kontaktdaten und das Thema auf."
            : "Möchten Sie, dass ich Ihre Anfrage direkt ans Team weiterleite? Dann nehme ich kurz Ihre Kontaktdaten auf.";

      return NextResponse.json({
        text: offerText,
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    // 3) Optional LLM Klassifikation (nur wenn Rule-First nicht greift)
    if (!ruleLeadType && settings.lead_enabled !== false && !offeredRecently && !handoff.completed) {
      const { offer_handoff, lead_type } = await classifyLeadIntentLLM(message);
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

    // 4) RAG
    let matches: RagMatch[] = [];
    try {
      matches = await ragSearch(tenant.id, message, 4);
    } catch (e) {
      console.error("[RAG] error:", e);
      matches = [];
    }

    const scored = (matches ?? []).filter(
      (m) => typeof m.similarity === "number" && !!m.content && m.content.trim().length > 0,
    );

    if (debugMode) {
      return NextResponse.json({
        slug,
        tenant,
        settings,
        matches: scored,
        threshold: MIN_SIMILARITY,
        handoff,
      });
    }

    if (scored.length === 0) {
      return NextResponse.json({
        text: settings.fallback_message,
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    const above = scored
      .filter((m) => m.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity);

    const top = (above.length > 0 ? above : scored)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    const kb = top.map((m) => `- ${m.content}`).join("\n");
    const system = systemPrompt(tenant.name, settings.fallback_message);

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

    const text = completion.choices[0]?.message?.content ?? settings.fallback_message;

    return NextResponse.json({
      text,
      welcome_message: settings.welcome_message,
      from_kb: true,
      handoff,
    });
  } catch (e: any) {
    console.error("API ERROR:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}