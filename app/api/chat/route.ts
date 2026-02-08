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

// Page Context (minimalistisch)
type PageContext = {
  page_url?: string | null;
  page_path?: string | null;
  page_title?: string | null;
  tenant_label?: string | null;
  surface?: string | null;
};

type HandoffState = {
  active: boolean;
  stage?: "offered" | "collect_name" | "collect_contact" | "collect_message" | "ready";
  lead_type?: LeadType;

  name?: string;
  first_name?: string | null;
  last_name?: string | null;

  email?: string;
  phone?: string;

  message?: string;

  appointment_topic?: string | null;
  appointment_window?: string | null;

  offered_at_ts?: number;
  completed?: boolean;

  preferred_contact?: "email" | "phone";

  page_context?: PageContext | null;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// RAG Threshold: welche Snippets kommen als Kandidaten überhaupt in Frage
const MIN_SIMILARITY = 0.20;
const KB_GOOD_ENOUGH = 0.22;

// ✅ Confidence Tuning
const HIGH_CONF_SIM = 0.35;
const MID_CONF_SIM = 0.25;
const MARGIN_CONF = 0.06;

// ✅ Medizin-Safety
const MEDICAL_SAFETY_FALLBACK =
  "Ich kann keine medizinische Beratung, Diagnose oder Behandlung durchführen. " +
  "Für eine medizinische Einschätzung wenden Sie sich bitte direkt an die Praxis oder den Notdienst. " +
  "Gern nenne ich Ihnen Praxisinfos (Öffnungszeiten, Kontakt, Leistungen laut Website).";

// --------------------
// Helpers
// --------------------

function splitName(fullName?: string | null) {
  if (!fullName) return { first_name: null as string | null, last_name: null as string | null };
  const t = fullName.trim().replace(/\s+/g, " ");
  const parts = t.split(" ").filter(Boolean);
  if (parts.length < 2) return { first_name: parts[0] ?? null, last_name: null };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function buildPageHint(context: PageContext | null) {
  const has =
    !!context?.page_path || !!context?.page_title || !!context?.page_url || !!context?.tenant_label;
  if (!has) return "";

  return `

Seitenkontext (wo befindet sich der Nutzer gerade?):
- Pfad: ${context?.page_path ?? "-"}
- Titel: ${context?.page_title ?? "-"}
- URL: ${context?.page_url ?? "-"}
- Label: ${context?.tenant_label ?? "-"}
- Surface: ${context?.surface ?? "-"}
`;
}

function slugFromReferer(req: NextRequest): string | null {
  const ref = req.headers.get("referer") || "";
  const m = ref.match(/\/embed\/([^/?#]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return null;
}

function messageFromMessages(body: any): string {
  const arr = body?.messages;
  if (!Array.isArray(arr) || arr.length === 0) return "";

  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    if (!m) continue;
    if (m.role !== "user") continue;

    const t =
      (typeof m.content === "string" ? m.content : "") ||
      (typeof m.text === "string" ? m.text : "");
    if (t && t.trim().length > 0) return t.trim();
  }

  return "";
}

function isMedicalTenant(tenantName: string, context: PageContext | null) {
  const s = `${tenantName || ""} ${context?.tenant_label || ""}`.toLowerCase();
  return (
    s.includes("arzt") ||
    s.includes("praxis") ||
    s.includes("medizin") ||
    s.includes("zahnarzt") ||
    s.includes("klinik") ||
    s.includes("therapie") ||
    s.includes("physio") ||
    s.includes("apotheke")
  );
}

function looksLikeMedicalAdviceQuestion(text: string) {
  const t = (text || "").toLowerCase();

  const isCapabilityQuestion =
    t.includes("was kannst du") ||
    t.includes("was kann der assistent") ||
    t.includes("wobei kannst du helfen") ||
    t.includes("wie kannst du helfen") ||
    t.includes("was machst du");

  if (isCapabilityQuestion) return false;

  const medicalAdviceSignals = [
    "ich habe",
    "ich hab",
    "symptom",
    "schmerzen",
    "fieber",
    "husten",
    "durchfall",
    "übelkeit",
    "schwindel",
    "ausschlag",
    "entzündung",
    "blut",
    "krampf",
    "herz",
    "atemnot",
    "brustschmerz",
    "diagnose",
    "behandeln",
    "therapie",
    "medikament",
    "tablette",
    "ibuprofen",
    "paracetamol",
    "antibiotika",
    "dosierung",
    "dosis",
    "wechselwirkung",
    "schwanger",
    "stillen",
    "notfall",
    "dringend",
    "sofort",
  ];

  return medicalAdviceSignals.some((k) => t.includes(k));
}

// ✅ Capability-Fragen erkennen (damit wir NICHT aus KB halluzinieren)
function isCapabilityQuestion(text: string) {
  const t = (text || "").trim().toLowerCase();

  const patterns = [
    "was kannst du",
    "was kann der assistent",
    "was kann dieser assistent",
    "wobei kannst du helfen",
    "wie kannst du helfen",
    "was machst du",
    "was sind deine funktionen",
    "welche funktionen hast du",
    "was kann der bot",
  ];

  if (patterns.some((p) => t.includes(p))) return true;

  if (t === "was kannst du?" || t === "was kannst du" || t === "was kann der assistent?")
    return true;

  return false;
}

// ✅ Kontakt-Info Fragen erkennen (damit wir NICHT direkt Handoff starten)
function isContactInfoQuestion(text: string) {
  const t = (text || "").toLowerCase();

  const contactIntents = [
    "kontakt",
    "kontakti",
    "erreichen",
    "telefon",
    "rufnummer",
    "nummer",
    "e-mail",
    "email",
    "mail",
    "adresse",
    "anschrift",
    "anfahrt",
    "wo finde ich",
    "standort",
    "öffnung",
    "öffnungszeiten",
    "sprechzeiten",
    "wann habt ihr offen",
    "wann geöffnet",
  ];

  // explizit „Terminanfrage“ ist trotzdem eher Lead
  if (t.includes("termin") && (t.includes("machen") || t.includes("vereinbaren") || t.includes("buchen")))
    return false;

  return contactIntents.some((k) => t.includes(k));
}

// ✅ Softes Handoff (als Hinweis am Ende, ohne direkt in Flow zu springen)
function appendSoftHandoffHint(text: string, leadEnabled: boolean, medicalTenant: boolean) {
  if (!leadEnabled) return text;

  const hint = medicalTenant
    ? "\n\nWenn Sie möchten, kann ich auch eine **Terminanfrage / Rückrufbitte** aufnehmen und an das Team weiterleiten."
    : "\n\nWenn Sie möchten, kann ich Ihre Anfrage auch **ans Team weiterleiten**.";

  const lower = (text || "").toLowerCase();
  if (lower.includes("weiterleiten") || lower.includes("rückruf") || lower.includes("terminanfrage")) {
    return text;
  }

  return `${text}${hint}`;
}

// ✅ Saubere Capability-Antworten (medizinisch vs. neutral)
function buildCapabilityAnswer(params: { tenantName: string; medicalTenant: boolean }): string {
  if (params.medicalTenant) {
    return (
      `Ich bin der digitale Assistent der Praxis „${params.tenantName}“ und helfe Ihnen mit Praxis-Informationen.\n\n` +
      `**Das kann ich für Sie tun:**\n` +
      `- Öffnungszeiten, telefonische Erreichbarkeit, Adresse & Anfahrt\n` +
      `- Kontaktmöglichkeiten (Telefon/E-Mail) und organisatorische Fragen\n` +
      `- Leistungen/Angebote **laut Website** (ohne medizinische Bewertung)\n` +
      `- Terminanfrage oder Rückrufwunsch aufnehmen und ans Team weiterleiten\n\n` +
      `**Wichtig:** Ich gebe **keine medizinische Beratung/Diagnosen/Therapie- oder Dosierungsempfehlungen**.`
    );
  }

  return (
    `Ich bin der digitale Assistent von „${params.tenantName}“.\n\n` +
    `**Das kann ich für Sie tun:**\n` +
    `- Fragen zu Öffnungszeiten, Kontakt, Standort und organisatorischen Abläufen\n` +
    `- Informationen aus den hinterlegten Unternehmensinhalten (Website/FAQ)\n` +
    `- Wenn etwas unklar ist: Ihre Anfrage aufnehmen und ans Team weiterleiten\n\n` +
    `**Hinweis:** Ich ersetze keine fachliche Beratung (z. B. rechtlich/medizinisch/finanziell).`
  );
}

// --------------------
// DB Helpers
// --------------------

async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin.from("tenants").select("*").eq("slug", slug).single();

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

function systemPrompt(companyName: string, fallbackMessage: string, safetyHint: string) {
  return `Rolle:
Du bist ein professioneller digitaler Assistent des Unternehmens "${companyName}".

REGELN:
- Antworte klar, höflich und direkt auf die Frage.
- Keine frei erfundenen Informationen.
- Wenn etwas nicht bekannt ist oder im Unternehmenswissen nicht vorkommt: Nutze sinngemäß: "${fallbackMessage}".
- Verwende kurze Absätze.
- Listen nur, wenn sinnvoll (max. 5–7 Punkte).
- Keine Begrüßung, kein Smalltalk, keine Abschlussfloskeln.

SICHERHEIT / KOMPLIANCE:
${safetyHint}

ZIEL:
Hilf der anfragenden Person schnell und zuverlässig mit Informationen des Unternehmens weiter.`;
}

// --------------------
// LLM KB-Gating
// --------------------

async function canAnswerFromKB(params: {
  question: string;
  kbBullets: string;
}): Promise<{ can_answer: boolean; answer?: string }> {
  const prompt = `
Du prüfst streng, ob die Nutzerfrage ausschließlich mit den KB-Snippets beantwortbar ist.

Gib ausschließlich JSON zurück:
{
  "can_answer": boolean,
  "answer": string | null
}

Regeln:
- can_answer = true nur wenn die Antwort klar aus den Snippets ableitbar ist.
- Wenn Infos fehlen / unklar / nicht enthalten: can_answer = false und answer = null.
- Keine externen Annahmen.

Nutzerfrage:
"""${params.question}"""

KB-Snippets:
${params.kbBullets}
`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = resp.choices[0]?.message?.content?.trim() || "{}";

  try {
    const obj = JSON.parse(raw);
    const can_answer = !!obj.can_answer;
    const answer =
      typeof obj.answer === "string" && obj.answer.trim().length > 0 ? obj.answer.trim() : null;
    return { can_answer, answer: answer ?? undefined };
  } catch {
    return { can_answer: false };
  }
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
    first_name: h?.first_name ?? null,
    last_name: h?.last_name ?? null,

    email: h?.email,
    phone: h?.phone,

    message: h?.message,

    appointment_topic: h?.appointment_topic ?? null,
    appointment_window: h?.appointment_window ?? null,

    offered_at_ts: h?.offered_at_ts,
    completed: !!h?.completed,

    preferred_contact: h?.preferred_contact,

    page_context: h?.page_context ?? null,
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

function looksLikeFullName(text: string) {
  const t = normalizeNameCandidate(text);
  if (t.length < 3 || t.length > 80) return false;
  if (extractEmail(t) || extractPhone(t)) return false;

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

async function extractAppointmentDetails(userText: string) {
  const prompt = `
Extrahiere aus der Nachricht:
- appointment_topic (Thema/Anlass)
- appointment_window (Zeitfenster/Wunschzeit)
Wenn nicht erkennbar: null.

Gib ausschließlich JSON zurück:
{
  "appointment_topic": string | null,
  "appointment_window": string | null
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
      appointment_topic:
        typeof obj.appointment_topic === "string" && obj.appointment_topic.trim()
          ? obj.appointment_topic.trim()
          : null,
      appointment_window:
        typeof obj.appointment_window === "string" && obj.appointment_window.trim()
          ? obj.appointment_window.trim()
          : null,
    };
  } catch {
    return { appointment_topic: null, appointment_window: null };
  }
}

// --------------------
// Lead Delivery
// --------------------

async function sendLeadViaApi(
  slug: string,
  lead: {
    type: LeadType;
    name?: string;
    email?: string;
    phone?: string;
    preferred_contact?: "email" | "phone" | null;
    message: string;
    metadata?: any;
    appointment_topic?: string | null;
    appointment_window?: string | null;
  },
) {
  const publicBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const base = publicBase || vercelHost;

  if (!base) {
    throw new Error("Missing base URL. Set NEXT_PUBLIC_BASE_URL in Vercel env.");
  }

  const res = await fetch(`${base}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      type: lead.type,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      preferred_contact: lead.preferred_contact ?? null,
      message: lead.message,
      appointment_topic: lead.appointment_topic ?? null,
      appointment_window: lead.appointment_window ?? null,
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

    const context: PageContext | null = (body?.context ?? null) as any;
    const url = new URL(req.url);

    const message =
      (body.message as string | undefined) ??
      url.searchParams.get("message") ??
      messageFromMessages(body) ??
      "";

    const slug =
      (body.slug as string | undefined) ??
      url.searchParams.get("slug") ??
      req.headers.get("x-tenant-slug") ??
      slugFromReferer(req) ??
      undefined;

    let handoff = normalizeHandoff(body.handoff);

    if (!handoff.page_context && context) {
      handoff.page_context = context;
    }

    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    // ✅ FIX: boolean normalisieren
    const leadEnabled = settings.lead_enabled !== false;

    const medicalTenant = isMedicalTenant(tenant.name, handoff.page_context ?? context ?? null);
    const contactInfo = isContactInfoQuestion(message);

    const safetyHint = medicalTenant
      ? `- Du führst keine medizinische Beratung/Diagnose/Behandlung durch und gibst keine Dosierungs- oder Therapieempfehlungen.
- Du darfst Leistungen der Praxis nur als "die Praxis bietet laut Website ..." beschreiben.
- Wenn eine Frage nach Symptomen/Behandlung/Medikation/Diagnose klingt: antworte kurz mit Hinweis + biete Termin-/Kontaktweiterleitung an.`
      : `- Du gibst keine rechtliche/medizinische/finanzielle Fachberatung.
- Du kannst Informationen aus dem Unternehmenswissen wiedergeben und bei Bedarf an das Team weiterleiten.`;

    // ✅ Capability-Fragen immer aus Template beantworten (kein KB!)
    if (isCapabilityQuestion(message)) {
      return NextResponse.json({
        text: buildCapabilityAnswer({ tenantName: tenant.name, medicalTenant }),
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    // ✅ harte Blockade für medizinische Beratungsfragen
    if (medicalTenant && looksLikeMedicalAdviceQuestion(message)) {
      const now = Date.now();
      const offeredRecently =
        typeof handoff.offered_at_ts === "number" && now - handoff.offered_at_ts < 120_000;

      if (leadEnabled && !handoff.completed && !offeredRecently) {
        handoff = {
          active: false,
          completed: false,
          stage: "offered",
          lead_type: "appointment",
          offered_at_ts: now,
          message: message.trim(),
          page_context: handoff.page_context ?? context ?? null,
        };

        return NextResponse.json({
          text:
            MEDICAL_SAFETY_FALLBACK +
            "\n\nSoll ich Ihre Anfrage an das Team weiterleiten und eine Terminanfrage aufnehmen?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      return NextResponse.json({
        text: MEDICAL_SAFETY_FALLBACK,
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    if (handoff.completed) {
      handoff = { active: false, completed: true };
    }

    // ---------------------------------------------------------
    // ✅ FIX #1: OFFER-RECENCY darf "JA" NICHT blocken
    // - offeredRecently soll nur verhindern, dass wir erneut anbieten,
    //   aber NICHT den Accept-Flow unterdrücken.
    // ---------------------------------------------------------
    const now = Date.now();
    const offeredRecently =
      handoff.stage === "offered"
        ? false
        : typeof handoff.offered_at_ts === "number" && now - handoff.offered_at_ts < 120_000;

    // --- Offer offen + Ja/Nein ---
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
    }

    // ---------------------------------------------------------
    // ✅ FIX #2 (HARD STOP):
    // Wenn Handoff aktiv ist, darf KEIN RAG/KB/Fallback mehr laufen.
    // (Verhindert genau den Bug aus deinem Screenshot.)
    // ---------------------------------------------------------
    if (handoff.active && !handoff.completed) {
      // --- 1) Handoff aktiv: stage-basiert sammeln ---
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

      // 1a) Name sammeln
      if (!handoff.name && handoff.stage === "collect_name") {
        if (extractEmail(raw) || extractPhone(raw)) {
          return NextResponse.json({
            text: "Danke. Bitte nennen Sie mir Ihren Namen (Vor- und Nachname).",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }

        if (looksLikeFullName(raw)) {
          handoff.name = normalizeNameCandidate(raw).replace(/\s*\([^)]*\)\s*$/g, "").trim();
          const s = splitName(handoff.name);
          handoff.first_name = s.first_name;
          handoff.last_name = s.last_name;

          handoff.stage = "collect_contact";
          return NextResponse.json({
            text: "Danke. Wie können wir Sie am besten erreichen – per E-Mail oder Telefon?",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }

        if (looksLikeSingleNamePart(raw)) {
          handoff.name = normalizeNameCandidate(raw).split(/\s+/)[0];
          handoff.first_name = handoff.name;
          handoff.last_name = null;

          return NextResponse.json({
            text: "Danke. Können Sie mir bitte noch Ihren Nachnamen nennen?",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff: { ...handoff, stage: "collect_name" },
          });
        }

        const llm = await extractWithLLM("collect_name", raw);
        if (llm.name && looksLikeFullName(llm.name)) {
          handoff.name = normalizeNameCandidate(llm.name).replace(/\s*\([^)]*\)\s*$/g, "").trim();
          const s = splitName(handoff.name);
          handoff.first_name = s.first_name;
          handoff.last_name = s.last_name;

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

      // Sonderfall: Nachname nachreichen
      if (handoff.stage === "collect_name" && handoff.name && !handoff.last_name) {
        const lastCandidate = normalizeNameCandidate(raw).replace(/\s*\([^)]*\)\s*$/g, "").trim();
        const okLast = /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(lastCandidate);
        if (okLast) {
          handoff.last_name = lastCandidate;
          handoff.name = `${handoff.first_name ?? handoff.name} ${handoff.last_name}`.trim();
          handoff.stage = "collect_contact";
          return NextResponse.json({
            text: "Danke. Wie können wir Sie am besten erreichen – per E-Mail oder Telefon?",
            welcome_message: settings.welcome_message,
            from_kb: false,
            handoff,
          });
        }
      }

      // 1b) Kontakt sammeln
      if (!handoff.email && !handoff.phone && handoff.stage === "collect_contact") {
        if (lower.includes("telefon")) handoff.preferred_contact = "phone";
        if (lower.includes("mail") || lower.includes("e-mail") || lower.includes("email"))
          handoff.preferred_contact = "email";

        const email = extractEmail(raw);
        const phone = extractPhone(raw);
        if (email) handoff.email = email;
        if (phone) handoff.phone = phone;

        if (!handoff.email && !handoff.phone) {
          const llm = await extractWithLLM("collect_contact", raw);
          if (llm.preferred_contact) handoff.preferred_contact = llm.preferred_contact;
          if (llm.email && extractEmail(llm.email)) handoff.email = extractEmail(llm.email);
          if (llm.phone && extractPhone(llm.phone)) handoff.phone = extractPhone(llm.phone);
        }

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

        const t = handoff.lead_type ?? "contact";

        // Sonderfall: wenn message schon da und contact => direkt senden
        if (handoff.message && t === "contact") {
          if (!leadEnabled || !settings.lead_email) {
            handoff = { active: false, completed: false };
            return NextResponse.json({
              text: settings.fallback_message,
              welcome_message: settings.welcome_message,
              from_kb: false,
              handoff,
            });
          }

          const leadType: LeadType = "contact";
          const leadMessage = handoff.message;

          const result = await sendLeadViaApi(slug, {
            type: leadType,
            name: handoff.name,
            email: handoff.email,
            phone: handoff.phone,
            preferred_contact: handoff.preferred_contact ?? null,
            message: leadMessage,
            appointment_topic: null,
            appointment_window: null,
            metadata: {
              source: "chat",
              lead_type: leadType,
              first_name: handoff.first_name ?? null,
              last_name: handoff.last_name ?? null,
              preferred_contact: handoff.preferred_contact ?? null,
              appointment_topic: null,
              appointment_window: null,
              kb_fallback_handoff: true,
              page_context: handoff.page_context ?? null,
            },
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

        handoff.stage = "collect_message";

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
      if (handoff.stage === "collect_message") {
        const t = handoff.lead_type ?? "contact";
        const raw2 = message.trim();

        if (handoff.message && t === "contact") {
          const additional = raw2.length >= 3 ? raw2 : null;
          if (additional && additional !== handoff.message) {
            handoff.message = `${handoff.message}\n\nZusatz: ${additional}`.trim();
          }
        } else {
          if (!handoff.message) {
            if (raw2.length >= 3) {
              handoff.message = raw2;
            } else {
              const llm = await extractWithLLM("collect_message", raw2);
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

            if ((handoff.lead_type ?? "contact") === "appointment") {
              const det = await extractAppointmentDetails(handoff.message);
              handoff.appointment_topic = det.appointment_topic;
              handoff.appointment_window = det.appointment_window;
            }
          } else {
            if (raw2.length >= 3) {
              handoff.message = `${handoff.message}\n\nZusatz: ${raw2}`.trim();
            }
          }
        }
      }

      if (!leadEnabled || !settings.lead_email) {
        handoff = { active: false, completed: false };
        return NextResponse.json({
          text: settings.fallback_message,
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      const leadType: LeadType = handoff.lead_type || "contact";
      const leadMessage = handoff.message || message.trim() || "Kontaktanfrage";

      const result = await sendLeadViaApi(slug, {
        type: leadType,
        name: handoff.name,
        email: handoff.email,
        phone: handoff.phone,
        preferred_contact: handoff.preferred_contact ?? null,
        message: leadMessage,
        appointment_topic: leadType === "appointment" ? handoff.appointment_topic ?? null : null,
        appointment_window: leadType === "appointment" ? handoff.appointment_window ?? null : null,
        metadata: {
          source: "chat",
          lead_type: leadType,
          first_name: handoff.first_name ?? null,
          last_name: handoff.last_name ?? null,
          preferred_contact: handoff.preferred_contact ?? null,
          appointment_topic: handoff.appointment_topic ?? null,
          appointment_window: handoff.appointment_window ?? null,
          kb_fallback_handoff: leadType === "contact" ? true : false,
          page_context: handoff.page_context ?? null,
        },
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

    // --- 2) Offer: Rule-first ---
    // ✅ Kontakt-Info Fragen: NICHT sofort Handoff anbieten -> erst RAG beantworten
    const bypassOffer = contactInfo;

    const ruleLeadType = detectLeadIntentRuleFirst(message);

    if (!bypassOffer && ruleLeadType && leadEnabled && !offeredRecently && !handoff.completed) {
      handoff = {
        active: false,
        completed: false,
        stage: "offered",
        lead_type: ruleLeadType,
        offered_at_ts: now,
        page_context: handoff.page_context ?? context ?? null,
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

    // --- 3) Optional LLM Klassifikation ---
    if (!bypassOffer && !ruleLeadType && leadEnabled && !offeredRecently && !handoff.completed) {
      const { offer_handoff, lead_type } = await classifyLeadIntentLLM(message);
      if (offer_handoff) {
        handoff = {
          active: false,
          completed: false,
          stage: "offered",
          lead_type,
          offered_at_ts: now,
          page_context: handoff.page_context ?? context ?? null,
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

    // --- 4) RAG ---
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

    const sorted = scored.sort((a, b) => b.similarity - a.similarity);

    const above = sorted
      .filter((m) => m.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity);

    const top = (above.length > 0 ? above : sorted).slice(0, 4);
    const kbBullets = top.map((m) => `- ${m.content}`).join("\n");
    const best = sorted[0];

    const second = sorted[1];
    const margin =
      best &&
      second &&
      typeof best.similarity === "number" &&
      typeof second.similarity === "number"
        ? best.similarity - second.similarity
        : 0;

    const HIGH_CONF =
      !!best &&
      typeof best.similarity === "number" &&
      (best.similarity >= HIGH_CONF_SIM || (best.similarity >= 0.30 && margin >= MARGIN_CONF));

    const MID_CONF =
      !!best && typeof best.similarity === "number" && best.similarity >= MID_CONF_SIM && !HIGH_CONF;

    if (url.searchParams.get("debug") === "1") {
      return NextResponse.json({
        slug,
        tenant,
        settings,
        leadEnabled,
        matches: sorted,
        threshold: MIN_SIMILARITY,
        kb_good_enough: KB_GOOD_ENOUGH,
        best_similarity: best?.similarity ?? null,
        second_similarity: second?.similarity ?? null,
        margin,
        HIGH_CONF,
        MID_CONF,
        handoff,
        context,
        contactInfo,
      });
    }

    if (sorted.length === 0) {
      if (leadEnabled && !handoff.completed && !offeredRecently) {
        handoff = {
          active: false,
          completed: false,
          stage: "offered",
          lead_type: "contact",
          offered_at_ts: now,
          message: message.trim(),
          page_context: handoff.page_context ?? context ?? null,
        };

        return NextResponse.json({
          text:
            "Dazu habe ich aktuell keine hinterlegten Informationen. " +
            "Soll ich Ihre Frage an das Team weiterleiten, damit Sie eine verlässliche Antwort erhalten?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      return NextResponse.json({
        text: settings.fallback_message,
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    if (
      best &&
      typeof best.similarity === "number" &&
      best.similarity < KB_GOOD_ENOUGH &&
      leadEnabled &&
      !handoff.completed &&
      !offeredRecently
    ) {
      handoff = {
        active: false,
        completed: false,
        stage: "offered",
        lead_type: "contact",
        offered_at_ts: now,
        message: message.trim(),
        page_context: handoff.page_context ?? context ?? null,
      };

      return NextResponse.json({
        text:
          "Ich habe dazu nur begrenzte Informationen hinterlegt. " +
          "Soll ich Ihre Frage an das Team weiterleiten, damit Sie eine verlässliche Antwort erhalten?",
        welcome_message: settings.welcome_message,
        from_kb: false,
        handoff,
      });
    }

    // ✅ MID_CONF => LLM-Gating
    if (MID_CONF && leadEnabled && !handoff.completed && !offeredRecently) {
      const gate = await canAnswerFromKB({
        question: message,
        kbBullets,
      });

      if (!gate.can_answer) {
        handoff = {
          active: false,
          completed: false,
          stage: "offered",
          lead_type: "contact",
          offered_at_ts: now,
          message: message.trim(),
          page_context: handoff.page_context ?? context ?? null,
        };

        return NextResponse.json({
          text:
            "Das kann ich aktuell nicht verlässlich aus den hinterlegten Informationen beantworten. " +
            "Soll ich Ihre Frage an das Team weiterleiten?",
          welcome_message: settings.welcome_message,
          from_kb: false,
          handoff,
        });
      }

      if (gate.answer && gate.answer.length > 0) {
        let out = gate.answer;

        if (contactInfo) {
          out = appendSoftHandoffHint(out, leadEnabled, medicalTenant);
        }

        return NextResponse.json({
          text: out,
          welcome_message: settings.welcome_message,
          from_kb: true,
          handoff,
        });
      }
    }

    // ✅ HIGH_CONF (oder MID_CONF ohne direkte Antwort) => normal aus KB antworten
    const system = systemPrompt(tenant.name, settings.fallback_message, safetyHint);
    const pageHint = buildPageHint(handoff.page_context ?? context ?? null);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Nutzerfrage:
"""${message}"""
${pageHint}
Unternehmenswissen:
${kbBullets}

Bitte antworte strukturiert, sachlich, hilfreich und ohne Begrüßung.
WICHTIG:
- Wenn es um medizinische Themen geht: formuliere ausschließlich als "Die Praxis bietet laut Website ..." und gib keine medizinische Beratung/Diagnose/Behandlungsempfehlungen.`,
        },
      ],
    });

    let text = completion.choices[0]?.message?.content ?? settings.fallback_message;

    // Post-Guard (medizinisch)
    if (medicalTenant) {
      const t = text.toLowerCase();
      const unsafeClaims = [
        "ich behandle",
        "ich diagnostiziere",
        "ich empfehle",
        "ich rate ihnen",
        "nehmen sie",
        "dosierung",
        "therapieplan",
        "ich kann sie behandeln",
        "ich kann ihnen eine therapie",
      ];
      if (unsafeClaims.some((k) => t.includes(k))) {
        text = MEDICAL_SAFETY_FALLBACK;
      }
    }

    if (contactInfo) {
      text = appendSoftHandoffHint(text, leadEnabled, medicalTenant);
    }

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