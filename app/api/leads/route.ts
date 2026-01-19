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
  return data; // { id, name, slug, ... }
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
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    // Kein LLM verfügbar -> harter Fallback
    return {
      one_liner: `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`,
      bullets: [],
      next_step: "Bitte prüfen und zeitnah zurückmelden.",
    };
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  const prompt = `
Erstelle ein extrem kurzes Team-Briefing (deutsch) für eine eingehende Anfrage.

Vorgaben:
- one_liner: genau 1 Satz, maximal 20 Wörter.
- bullets: 0 bis 3 Bulletpoints, jeweils maximal 12 Wörter.
- next_step: genau 1 kurze Handlungsaufforderung.
- Keine Floskeln, keine Begrüßung.

Gib ausschließlich gültiges JSON zurück in diesem Schema:
{
  "one_liner": "string",
  "bullets": ["string", "..."],
  "next_step": "string"
}

Kontext:
Unternehmen: ${input.tenantName}
Lead-Typ: ${input.leadType}

Daten:
Name: ${input.name ?? ""}
E-Mail: ${input.email ?? ""}
Telefon: ${input.phone ?? ""}
Bevorzugter Kontakt: ${input.preferred_contact ?? ""}
Termin-Thema: ${input.appointment_topic ?? ""}
Termin-Zeitfenster: ${input.appointment_window ?? ""}

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
    const obj = JSON.parse(raw);

    const one_liner =
      typeof obj.one_liner === "string" && obj.one_liner.trim()
        ? obj.one_liner.trim()
        : `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`;

    const bullets =
      Array.isArray(obj.bullets) ? obj.bullets.filter((b) => typeof b === "string" && b.trim()).slice(0, 3) : [];

    const next_step =
      typeof obj.next_step === "string" && obj.next_step.trim()
        ? obj.next_step.trim()
        : "Bitte prüfen und zeitnah zurückmelden.";

    return { one_liner, bullets, next_step };
  } catch (e) {
    console.warn("generateTeamBriefing failed, using fallback:", e);
    return {
      one_liner: `${leadTypeLabel(input.leadType)}: ${input.message.slice(0, 140)}`,
      bullets: [],
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
    const typeRaw = body.type;
    const type: LeadType = isLeadType(typeRaw) ? typeRaw : "contact";

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

    if (!slug) {
      return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
    }

    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    // Leads deaktiviert oder kein Empfänger -> sauberer Fehler
    if (settings.lead_enabled === false) {
      return NextResponse.json({ ok: false, error: "lead capture disabled" }, { status: 403 });
    }
    if (!settings.lead_email) {
      return NextResponse.json({ ok: false, error: "lead_email missing for tenant" }, { status: 422 });
    }

    // 1) In DB speichern (bestehendes Schema beibehalten: nur Felder, die bei dir bereits funktionieren)
    const { data: inserted, error: insErr } = await supaAdmin
      .from("leads")
      .insert({
        tenant_id: tenant.id,
        name: name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        message,
        // optional – falls Spalten existieren, sind sie hilfreich; wenn nicht, nimm sie raus.
        type,
        preferred_contact,
        appointment_topic,
        appointment_window,
        metadata,
      } as any)
      .select("id")
      .single();

    if (insErr) {
      console.error("leads insert error:", insErr);
      return NextResponse.json({ ok: false, error: "DB insert failed" }, { status: 500 });
    }

    // 2) Team-Briefing generieren (nur für E-Mail)
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

    // 3) E-Mail senden
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!resendKey || !from) {
      console.error("Missing RESEND_API_KEY or RESEND_FROM");
      return NextResponse.json(
        { ok: false, error: "Email not configured (missing RESEND_API_KEY or RESEND_FROM)" },
        { status: 500 },
      );
    }

    const resend = new Resend(resendKey);

    const subject = `[${tenant.name}] ${leadTypeLabel(type)} – ${name ?? email ?? phone ?? "Neue Anfrage"}`;

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5;">
        <h2 style="margin:0 0 12px 0;">${escapeHtml(leadTypeLabel(type))}</h2>

        <div style="padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb; margin-bottom:14px;">
          <div style="font-weight:600; margin-bottom:6px;">Team-Briefing</div>
          <div>${escapeHtml(briefing.one_liner)}</div>
          ${
            briefing.bullets.length
              ? `<ul style="margin:8px 0 8px 18px;">${briefing.bullets
                  .map((b: string) => `<li>${escapeHtml(b)}</li>`)
                  .join("")}</ul>`
              : ``
          }
          <div style="margin-top:8px;"><b>Nächster Schritt:</b> ${escapeHtml(briefing.next_step)}</div>
        </div>

        <div style="padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px;">
          <div style="font-weight:600; margin-bottom:8px;">Details</div>
          <div><b>Tenant:</b> ${escapeHtml(tenant.name)} (${escapeHtml(slug)})</div>
          ${name ? `<div><b>Name:</b> ${escapeHtml(name)}</div>` : ``}
          ${email ? `<div><b>E-Mail:</b> ${escapeHtml(email)}</div>` : ``}
          ${phone ? `<div><b>Telefon:</b> ${escapeHtml(phone)}</div>` : ``}
          ${preferred_contact ? `<div><b>Bevorzugter Kontakt:</b> ${escapeHtml(preferred_contact)}</div>` : ``}
          ${
            type === "appointment"
              ? `
                ${appointment_topic ? `<div><b>Termin-Thema:</b> ${escapeHtml(appointment_topic)}</div>` : ``}
                ${appointment_window ? `<div><b>Zeitfenster:</b> ${escapeHtml(appointment_window)}</div>` : ``}
              `
              : ``
          }
          <div style="margin-top:10px;"><b>Nachricht:</b></div>
          <div style="white-space:pre-wrap; background:#fafafa; border:1px solid #eee; padding:10px; border-radius:10px;">
            ${escapeHtml(message)}
          </div>
        </div>
      </div>
    `;

    const text = [
      `${leadTypeLabel(type)} – ${tenant.name} (${slug})`,
      "",
      "TEAM-BRIEFING",
      briefing.one_liner,
      ...(briefing.bullets.length ? ["", ...briefing.bullets.map((b: string) => `- ${b}`)] : []),
      "",
      `Nächster Schritt: ${briefing.next_step}`,
      "",
      "DETAILS",
      name ? `Name: ${name}` : "",
      email ? `E-Mail: ${email}` : "",
      phone ? `Telefon: ${phone}` : "",
      preferred_contact ? `Bevorzugter Kontakt: ${preferred_contact}` : "",
      type === "appointment" && appointment_topic ? `Termin-Thema: ${appointment_topic}` : "",
      type === "appointment" && appointment_window ? `Zeitfenster: ${appointment_window}` : "",
      "",
      "Nachricht:",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    const send = await resend.emails.send({
      from,
      to: settings.lead_email,
      subject,
      html,
      text,
    });

    // 4) Antwort an Client
    return NextResponse.json({
      ok: true,
      lead_id: inserted?.id,
      email_sent: !!send?.data?.id,
      message: settings.lead_auto_reply || "Vielen Dank! Wir melden uns zeitnah.",
    });
  } catch (e: any) {
    console.error("/api/leads error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}