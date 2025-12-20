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
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("welcome_message, fallback_message")
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

// --- Haupt-Handler (POST) ---
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
    });
  } catch (e: any) {
    console.error("API ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 },
    );
  }
}