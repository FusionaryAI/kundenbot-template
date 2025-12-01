import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "@/lib/db";

// --- Guardrails ---
function checkEmergency(t: string) {
  const x = t.toLowerCase();
  return [
    "brustschmerzen",
    "atemnot",
    "lähmung",
    "starke blutung",
    "bewusstlos",
    "suizid",
    "vergiftung",
    "schlaganfall",
    "herzinfarkt",
  ].some((k) => x.includes(k));
}

function needsMedicalAdviceBlock(t: string) {
  const x = t.toLowerCase();
  return [
    "diagnose",
    "medikament",
    "dosierung",
    "antibiotikum",
    "behandlung",
  ].some((k) => x.includes(k));
}

const EMERGENCY_MSG =
  "Bei akuter Gefahr rufen Sie bitte sofort **112** an. Außerhalb der Sprechzeiten erreichen Sie den ärztlichen Bereitschaftsdienst unter **116 117**.";

const MEDICAL_BLOCK_MSG =
  "Das darf ich hier nicht beurteilen. Gern unterstütze ich bei der Terminvereinbarung in der Praxis.";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// --- Fetch Tenant & Vars ---
async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

async function getTenantVariables(tenant_id: string) {
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("variables")
    .eq("tenant_id", tenant_id)
    .single();
  if (error) throw error;
  return data!.variables as any;
}

// --- System Prompt: weniger Bullet-Spam ---
function systemPrompt(vars: any) {
  return `Rolle:
Sie sind der digitale Praxis-Assistent der ${vars.Praxisname} in ${vars.Ort}.

WICHTIGE REGELN:

- Keine Diagnosen oder Therapieempfehlungen geben.
- In Notfällen: 112, außerhalb der Sprechzeiten: 116 117.
- Antworten immer direkt auf die Frage, ohne Begrüßung oder Abschlussformeln.
- Höflicher Ton, Sie-Form.
- Kurze, übersichtliche Absätze. Standard ist normaler Fließtext.

FORMATIERUNG:

- Standard: Antworten Sie in normalem Fließtext mit kurzen Absätzen.
- Verwenden Sie Markdown-Listen mit "- " nur dann, wenn Sie mehrere eigenständige Punkte aufzählen:
  - z. B. Leistungen, Öffnungszeiten, Schritte, Voraussetzungen, verschiedene Optionen
- Nutzen Sie pro Liste höchstens 5–7 Bulletpoints.
- Erfinden Sie keine Listen, wenn ein normaler Satz ausreicht.
- Keine Sternchenformatierung (**Text**), nur klare Absätze und ggf. Listen.

ÖFFNUNGSZEITEN:

- Öffnungszeiten nach Möglichkeit als Liste:
  - Montag: 08:00–12:00, 16:00–17:00
  - Dienstag: ...
- Wenn nur eine einzelne Zeit genannt wird, genügt ein normaler Satz.

UMGANG MIT FEHLENDEN INFORMATIONEN:

- Wenn Informationen in den Praxisdaten nicht vorhanden sind, sagen Sie das offen.
- Verweisen Sie dann auf die Kontaktmöglichkeit der Praxis und nennen Sie die Telefonnummer ${vars.Kontakt_Tel}.

TERMINANFRAGEN:

- Wenn jemand einen Termin möchte, fragen Sie strukturiert nach:
  - vollständigem Namen
  - Geburtsdatum (TT.MM.JJJJ)
  - Telefonnummer
  - kurzem Anliegen
  - bevorzugtem Zeitraum
  - Einverständnis zur Weitergabe

Antwortzeit der Praxis: ${vars.Antwortzeit}.`;
}

// --- RAG Search ---
async function ragSearch(tenant_id: string, query: string, k = 4) {
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: query,
  });
  const q = emb.data[0].embedding;

  const { data, error } = await supaAdmin.rpc("match_embeddings", {
    query_embedding: q,
    match_count: k,
    p_tenant_id: tenant_id,
  });

  if (error) throw error;
  return data as { id: string; content: string; distance: number }[];
}

export async function POST(req: NextRequest) {
  try {
    // ---- Body + URL auslesen ----
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

    // **hier wird der Slug robust ermittelt**
    const slugFromBody = body.slug as string | undefined;
    const slugFromQuery = url.searchParams.get("slug") ?? undefined;
    const slugFromHeader = req.headers.get("x-tenant-slug") ?? undefined;

    const slug =
      slugFromBody ||
      slugFromQuery ||
      slugFromHeader ||
      "hausarzt-painten"; // Fallback für diese Praxis

    if (!message) {
      return NextResponse.json(
        { error: "message required" },
        { status: 400 }
      );
    }

    const tenant = await getTenantBySlug(slug);
    const vars = await getTenantVariables(tenant.id);

    // --- Guardrails First ---
    if (checkEmergency(message)) {
      return NextResponse.json({
        text: `${EMERGENCY_MSG}\n\nWie kann ich organisatorisch helfen (Termin, Öffnungszeiten, Kontakt)?`,
      });
    }

    if (needsMedicalAdviceBlock(message)) {
      return NextResponse.json({
        text: `${MEDICAL_BLOCK_MSG} Möchten Sie eine Terminanfrage stellen?`,
      });
    }

    // --- RAG Retrieval ---
    const matches = await ragSearch(tenant.id, message, 4);
    const kb = matches.map((m) => `- ${m.content}`).join("\n");

    const system = systemPrompt(vars);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Nutzerfrage:
"""${message}"""

Praxiswissen (Stichpunkte / Textauszüge):
${kb}

Formatiere deine Antwort wie folgt:

- Standard ist normaler Fließtext mit kurzen Absätzen.
- Nutze eine kurze Markdown-Liste mit "- " nur, wenn die Frage nach mehreren Leistungen, Öffnungszeiten, Vorteilen, Schritten oder ähnlichen Aufzählungen fragt oder wenn mehrere Punkte klar getrennt dargestellt werden sollen.
- Verwende pro Liste höchstens 5–7 Bulletpoints.
- Wenn es nur ein einzelner Hinweis oder eine kurze Erklärung ist, nutze keinen Listenpunkt, sondern normalen Text.
- Keine Begrüßung, kein Gruß, sachlicher Chat-Stil.
`,
        },
      ],
    });

    const text =
      completion.choices[0]?.message?.content ??
      "Entschuldigung, dazu habe ich gerade keine Auskunft.";

    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 },
    );
  }
}
