import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Resend } from "resend";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

type LeadType = "contact" | "appointment" | "callback";

type TenantSettings = {
  lead_enabled?: boolean | null;
  lead_email?: string | null;
  lead_auto_reply?: string | null;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function isLeadType(v: any): v is LeadType {
  return v === "contact" || v === "appointment" || v === "callback";
}

async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("getTenantBySlug error:", error, "slug:", slug);
    throw new Error("Tenant not found");
  }
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
  if (!process.env.OPENAI_API_KEY) {
    return {
      one_liner: `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`,
      bullets: [] as string[],
      next_step: "Bitte prüfen und zeitnah zurückmelden.",
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = resp.choices[0]?.message?.content?.trim() || "{}";
    const obj: unknown = JSON.parse(raw);

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const slug = safeStr(body.slug);
    const type: LeadType = isLeadType(body.type) ? body.type : "contact";

    const name = safeStr(body.name) || undefined;
    const email = safeStr(body.email) || undefined;
    const phone = safeStr(body.phone) || undefined;
    const preferred_contact =
      body.preferred_contact === "email" || body.preferred_contact === "phone"
        ? body.preferred_contact
        : null;

    const message = safeStr(body.message);
    const appointment_topic = safeStr(body.appointment_topic) || null;
    const appointment_window = safeStr(body.appointment_window) || null;
    const metadata = body.metadata ?? { source: "chat" };

    if (!slug || !message) {
      return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
    }

    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    if (settings.lead_enabled === false || !settings.lead_email) {
      return NextResponse.json({ ok: false, error: "lead disabled" }, { status: 403 });
    }

    const { data: inserted, error: insErr } = await supaAdmin
      .from("leads")
      .insert({
        tenant_id: tenant.id,
        name: name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        message,
        type,
        preferred_contact,
        appointment_topic,
        appointment_window,
        metadata,
      } as any)
      .select("id")
      .single();

    if (insErr) {
      console.error("DB insert error:", insErr);
      return NextResponse.json({ ok: false, error: "DB insert failed" }, { status: 500 });
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
      <p><b>E-Mail:</b> ${escapeHtml(email ?? "-")}</p>
      <p><b>Telefon:</b> ${escapeHtml(phone ?? "-")}</p>
      <pre>${escapeHtml(message)}</pre>
    `;

    const send = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: settings.lead_email,
      subject,
      html,
      text: briefing.one_liner + "\n\n" + message,
    });

    return NextResponse.json({
      ok: true,
      lead_id: inserted.id,
      email_sent: !!send?.data?.id,
      message: settings.lead_auto_reply || "Vielen Dank! Wir melden uns zeitnah.",
    });
  } catch (e: any) {
    console.error("/api/leads error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}