import { after } from "next/server";
import { Resend } from "resend";
import { supaAdmin } from "@/lib/db";
import { markConversationAsLead } from "@/lib/analytics";
import { notifyIntegrations } from "@/lib/integrations/notify";
import { llm, chatModel, hasLlmApiKey, parseJsonReply } from "@/lib/llm";

// Lead-Erfassung: speichern, Team per E-Mail benachrichtigen, Integrationen
// anstoßen. Aufgerufen von POST /api/leads und direkt vom Chat-Handler (früher
// per HTTP-Selbstaufruf — der lief am Rate Limit vorbei bzw. hätte alle Chat-
// Leads unter der Server-IP gemeinsam gezählt).

/** Erwartbarer Fehler mit HTTP-Status; die Meldung ist für Clients unbedenklich. */
export class LeadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type LeadInput = {
  slug: string;
  type: LeadType;
  name?: string;
  email?: string;
  phone?: string;
  preferred_contact: "email" | "phone" | null;
  message: string;
  appointment_topic: string | null;
  appointment_window: string | null;
  conversation_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- frei strukturierte Zusatzdaten (jsonb), Felder werden einzeln geprüft
  metadata: any;
};

export type LeadType = "contact" | "appointment" | "callback";

type TenantSettings = {
  lead_enabled?: boolean | null;
  lead_email?: string | null;
  lead_auto_reply?: string | null;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export function isLeadType(v: unknown): v is LeadType {
  return v === "contact" || v === "appointment" || v === "callback";
}

async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) throw new LeadError(404, "unknown tenant");
  return data;
}

async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("lead_enabled, lead_email, lead_auto_reply")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    return { lead_enabled: true, lead_email: null, lead_auto_reply: null };
  }
  return data as TenantSettings;
}

function leadTypeLabel(t: LeadType) {
  if (t === "appointment") return "Terminanfrage";
  if (t === "callback") return "Rückrufbitte";
  return "Kontaktanfrage";
}

async function generateTeamBriefing(input: {
  tenantName: string;
  leadType: LeadType;
  name?: string;
  email?: string;
  phone?: string;
  preferred_contact?: "email" | "phone" | null;
  message: string;
  appointment_topic?: string | null;
  appointment_window?: string | null;
}) {
  if (!hasLlmApiKey()) {
    return {
      one_liner: `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`,
      bullets: [] as string[],
      next_step: "Bitte prüfen und zeitnah zurückmelden.",
    };
  }

  const prompt = `
Erstelle ein extrem kurzes Team-Briefing (deutsch).

Regeln:
- one_liner: exakt 1 Satz, max. 20 Wörter
- bullets: 0–3 Punkte, max. 12 Wörter je Punkt
- next_step: exakt 1 kurze Handlungsempfehlung
- Keine Floskeln

JSON-Schema:
{
  "one_liner": "string",
  "bullets": ["string"],
  "next_step": "string"
}

Unternehmen: ${input.tenantName}
Lead-Typ: ${input.leadType}

Name: ${input.name ?? ""}
E-Mail: ${input.email ?? ""}
Telefon: ${input.phone ?? ""}
Kontaktpräferenz: ${input.preferred_contact ?? ""}
Termin-Thema: ${input.appointment_topic ?? ""}
Zeitfenster: ${input.appointment_window ?? ""}

Nachricht:
"""${input.message}"""
`;

  try {
    const resp = await llm().chat.completions.create({
      model: chatModel(),
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = resp.choices[0]?.message?.content?.trim() || "{}";
    const obj: unknown = parseJsonReply(raw);

    const one_liner =
      typeof (obj as any).one_liner === "string" && (obj as any).one_liner.trim()
        ? (obj as any).one_liner.trim()
        : `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`;

    const bullets: string[] = Array.isArray((obj as any).bullets)
      ? ((obj as any).bullets as unknown[])
          .filter((b: unknown): b is string => typeof b === "string" && b.trim().length > 0)
          .slice(0, 3)
      : [];

    const next_step =
      typeof (obj as any).next_step === "string" && (obj as any).next_step.trim()
        ? (obj as any).next_step.trim()
        : "Bitte prüfen und zeitnah zurückmelden.";

    return { one_liner, bullets, next_step };
  } catch (e) {
    console.warn("Briefing fallback:", e);
    return {
      one_liner: `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`,
      bullets: [] as string[],
      next_step: "Bitte prüfen und zeitnah zurückmelden.",
    };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPageContextHtml(metadata: any) {
  const pc = metadata?.page_context ?? null;
  if (!pc || typeof pc !== "object") return "";

  const page_path = safeStr((pc as any).page_path ?? "");
  const page_title = safeStr((pc as any).page_title ?? "");
  const page_url = safeStr((pc as any).page_url ?? "");
  const tenant_label = safeStr((pc as any).tenant_label ?? "");
  const surface = safeStr((pc as any).surface ?? "");

  const hasAny = !!(page_path || page_title || page_url || tenant_label || surface);
  if (!hasAny) return "";

  return `
    <hr/>
    <p><b>Seitenkontext</b></p>
    <ul>
      <li><b>Pfad:</b> ${escapeHtml(page_path || "-")}</li>
      <li><b>Titel:</b> ${escapeHtml(page_title || "-")}</li>
      <li><b>URL:</b> ${escapeHtml(page_url || "-")}</li>
      <li><b>Label:</b> ${escapeHtml(tenant_label || "-")}</li>
      <li><b>Surface:</b> ${escapeHtml(surface || "-")}</li>
    </ul>
  `;
}

export async function createLead(input: LeadInput) {
  const {
    slug, type, name, email, phone, preferred_contact, message,
    appointment_topic, appointment_window, conversation_id, metadata,
  } = input;

  // ✅ aus metadata in Spalten übernehmen (falls vorhanden)
  const first_name = safeStr(metadata?.first_name ?? "") || null;
  const last_name = safeStr(metadata?.last_name ?? "") || null;

  // Manche verwenden "lead_type" zusätzlich zur "type"-Spalte
  const lead_type: LeadType = isLeadType(metadata?.lead_type) ? metadata.lead_type : type;

  const tenant = await getTenantBySlug(slug);
  const settings = await getTenantSettings(tenant.id);

  if (settings.lead_enabled === false || !settings.lead_email) {
    throw new LeadError(403, "lead disabled");
  }

  const { data: inserted, error: insErr } = await supaAdmin
    .from("leads")
    .insert({
      tenant_id: tenant.id,
      name: name ?? null,
      email: email ?? null,
      phone: phone ?? null,
      message,
      type, // bleibt wie gehabt
      preferred_contact,
      appointment_topic,
      appointment_window,

      // ✅ NEU: echte Spalten befüllen
      first_name,
      last_name,
      lead_type, // falls Spalte existiert

      metadata,
    } as any)
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[leads] DB insert error:", insErr?.message);
    throw new LeadError(500, "DB insert failed");
  }

  // Mark originating chat conversation as converted (best-effort; never blocks).
  if (conversation_id) {
    markConversationAsLead(tenant.id, conversation_id).catch((e) =>
      console.error("[leads] markConversationAsLead:", e)
    );
  }

  const briefing = await generateTeamBriefing({
    tenantName: tenant.name,
    leadType: type,
    name,
    email,
    phone,
    preferred_contact,
    message,
    appointment_topic,
    appointment_window,
  });

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const subject = `[${tenant.name}] ${leadTypeLabel(type)} – ${name ?? email ?? "Neue Anfrage"}`;

  const pageCtxHtml = renderPageContextHtml(metadata);

  const html = `
    <h2>${escapeHtml(leadTypeLabel(type))}</h2>
    <p><b>Team-Briefing</b><br>${escapeHtml(briefing.one_liner)}</p>
    ${
      briefing.bullets.length
        ? `<ul>${briefing.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : ""
    }
    <p><b>Nächster Schritt:</b> ${escapeHtml(briefing.next_step)}</p>
    <hr/>
    <p><b>Name:</b> ${escapeHtml(name ?? "-")}</p>
    <p><b>Vorname:</b> ${escapeHtml(first_name ?? "-")}</p>
    <p><b>Nachname:</b> ${escapeHtml(last_name ?? "-")}</p>
    <p><b>Lead-Type:</b> ${escapeHtml(lead_type ?? "-")}</p>
    <p><b>E-Mail:</b> ${escapeHtml(email ?? "-")}</p>
    <p><b>Telefon:</b> ${escapeHtml(phone ?? "-")}</p>
    ${pageCtxHtml}
    <pre>${escapeHtml(message)}</pre>
  `;

  const send = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: settings.lead_email,
    replyTo: process.env.RESEND_REPLY_TO || undefined,
    subject,
    html,
    text: briefing.one_liner + "\n\n" + message,
  });
  // Resend wirft bei Ablehnung (ungültiger Key, nicht verifizierte Domain)
  // nicht, sondern liefert `error` — ohne Log bliebe der Ausfall unsichtbar.
  if (send.error) {
    console.error("[leads] Resend-Versand fehlgeschlagen:", send.error.name, send.error.message);
  }

  // Integrationen (Slack, HubSpot, Pipedrive) nach der Antwort ausführen —
  // im selben Prozess, ohne öffentlichen HTTP-Umweg.
  after(() =>
    notifyIntegrations(tenant.id, {
      tenant_id: tenant.id,
      name: name ?? null,
      email: email ?? null,
      phone: phone ?? null,
      message,
      type,
      appointment_topic,
      appointment_window,
    }),
  );

  return {
    lead_id: inserted.id as string,
    email_sent: !!send?.data?.id,
    message: settings.lead_auto_reply || "Vielen Dank! Wir melden uns zeitnah.",
  };
}
