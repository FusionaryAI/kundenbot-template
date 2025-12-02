import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// --- Fetch Tenant ---
async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !data) {
    console.error("getTenantBySlug error:", error);
    throw new Error("Tenant not found");
  }
  return data; // { id, name, slug }
}

// --- Fetch Tenant Settings ---
async function getTenantSettings(tenantId: string) {
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("welcome_message, fallback_message")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    console.warn("tenant_settings not found, using defaults");
    return {
      welcome_message: "Wie kann ich Ihnen helfen?",
      fallback_message:
        "Leider habe ich hierzu noch keine Informationen hinterlegt.",
    };
  }

  return data;
}

// --- Vector RAG Search ---
async function ragSearch(tenantId: string, query: string, k = 4) {
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 Dimensionen
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

  return (data ?? []) as {
    id: string;
    content: string;
    similarity: number;
  }[];
}

// --- System Prompt (neutral, für ALLE Branchen) ---
function systemPrompt(companyName: string, fallbackMessage: string) {
  return `Rolle:
Du bist ein professioneller digitaler Assistent des Unternehmens "${companyName}".

REGELN:
- Antworte klar, höflich und direkt auf die Frage.
- Keine frei erfundenen Informationen.
- Wenn etwas nicht bekannt ist: Nutze sinngemäß: "${fallbackMessage}".
- Verwende kurze Absätze.
- Listen nur, wenn sinnvoll (max. 5–7 Punkte).
- Keine Begrüßung, kein Smalltalk, keine Abschlussfloskeln.

ZIEL:
Hilf der anfragenden Person schnell und zuverlässig mit Informationen des Unternehmens weiter.`;
}

// --- Haupt-API ---
export async function POST(req: NextRequest) {
  try {
    // Body lesen
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const url = new URL(req.url);

    const message =
      body.message ??
      url.searchParams.get("message") ??
      "";

    const slug =
      body.slug ??
      url.searchParams.get("slug") ??
      req.headers.get("x-tenant-slug") ??
      "kunden-muster"; // Fallback für Demo

    if (!message) {
      return NextResponse.json(
        { error: "message required" },
        { status: 400 }
      );
    }

    // Datenbank: Tenant + Settings
    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    // --- RAG / Wissenssuche ---
    let matches: { id: string; content: string; similarity: number }[] = [];
    try {
      matches = await ragSearch(tenant.id, message, 4);
    } catch (e) {
      console.warn("ragSearch failed:", e);
    }

    const kb =
      matches.length > 0
        ? matches.map((m) => `- ${m.content}`).join("\n")
        : "- Es sind noch keine Wissensinhalte hinterlegt.";

    const system = systemPrompt(
      tenant.name,
      settings.fallback_message
    );

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
      completion.choices[0]?.message?.content ??
      settings.fallback_message;

    return NextResponse.json({
      text,
      welcome_message: settings.welcome_message,
    });
  } catch (e: any) {
    console.error("API ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}
