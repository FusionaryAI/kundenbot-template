import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { Resend } from "resend";

export const runtime = "nodejs";

type LeadType = "contact" | "appointment" | "callback";
type PreferredContact = "email" | "phone" | null;

function isEmail(v: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v.trim());
}

function extractEmail(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0] ?? null;
}

function extractPhone(text: string) {
  const m = text.match(/(\+?\d[\d\s().-]{6,}\d)/);
  return m?.[0] ?? null;
}

function splitName(fullName?: string | null) {
  if (!fullName) return { first_name: null as string | null, last_name: null as string | null };
  const t = fullName.trim().replace(/\s+/g, " ");
  const parts = t.split(" ").filter(Boolean);
  if (parts.length < 2) return { first_name: parts[0] ?? null, last_name: null };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function formatLeadTypeLabel(t: LeadType) {
  if (t === "appointment") return "Terminanfrage";
  if (t === "callback") return "Rückrufbitte";
  return "Kontaktanfrage";
}

function safeJson(v: any) {
  try {
    if (v == null) return {};
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function buildEmailHtml(input: {
  tenantName: string;
  leadType: LeadType;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_contact?: PreferredContact;
  message: string;
  appointment_topic?: string | null;
  appointment_window?: string | null;
  createdAtIso: string;
  leadId: string;
  slug: string;
}) {
  const pref =
    input.preferred_contact === "phone"
      ? "Telefon"
      : input.preferred_contact === "email"
        ? "E-Mail"
        : "—";

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const showAppt = input.leadType === "appointment";

  return `
  <div style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif; line-height:1.45; color:#111;">
    <h2 style="margin:0 0 12px 0;">Neue ${esc(formatLeadTypeLabel(input.leadType))}</h2>
    <p style="margin:0 0 14px 0;">
      <strong>Unternehmen:</strong> ${esc(input.tenantName)}<br/>
      <strong>Tenant:</strong> ${esc(input.slug)}<br/>
      <strong>Lead-ID:</strong> ${esc(input.leadId)}<br/>
      <strong>Zeitpunkt:</strong> ${esc(input.createdAtIso)}
    </p>

    <table style="border-collapse: collapse; width:100%; max-width:720px;">
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb; width:180px;"><strong>Name</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.name ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Vorname</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.first_name ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Nachname</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.last_name ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>E-Mail</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.email ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Telefon</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.phone ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Bevorzugt</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(pref)}</td>
      </tr>

      ${
        showAppt
          ? `
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Termin-Thema</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.appointment_topic ?? "—")}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Wunschzeit</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;">${esc(input.appointment_window ?? "—")}</td>
      </tr>
      `
          : ""
      }

      <tr>
        <td style="padding:8px 10px; border:1px solid #e5e7eb;"><strong>Anliegen</strong></td>
        <td style="padding:8px 10px; border:1px solid #e5e7eb; white-space:pre-wrap;">${esc(
          input.message,
        )}</td>
      </tr>
    </table>

    <p style="margin:14px 0 0 0; color:#6b7280; font-size:12px;">
      Quelle: Website-Chat (Fusionary AI)
    </p>
  </div>
  `;
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

async function getTenantLeadSettings(tenantId: string) {
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("lead_enabled, lead_email, lead_auto_reply")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    return {
      lead_enabled: true,
      lead_email: null as string | null,
      lead_auto_reply: "Vielen Dank! Wir melden uns zeitnah.",
    };
  }

  return {
    lead_enabled: data.lead_enabled ?? true,
    lead_email: data.lead_email ?? null,
    lead_auto_reply: data.lead_auto_reply ?? "Vielen Dank! Wir melden uns zeitnah.",
  };
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const slug = (body.slug as string | undefined)?.trim();
    const type = (body.type as LeadType | undefined) ?? "contact";
    const message = (body.message as string | undefined)?.trim() ?? "";

    if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    if (!message || message.length < 3) {
      return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
    }

    const leadType: LeadType =
      type === "appointment" || type === "callback" || type === "contact" ? type : "contact";

    const tenant = await getTenantBySlug(slug);
    const leadSettings = await getTenantLeadSettings(tenant.id);

    if (leadSettings.lead_enabled === false) {
      return NextResponse.json({ ok: false, error: "leads disabled for tenant" }, { status: 403 });
    }

    const notifyTo = leadSettings.lead_email;
    if (!notifyTo || !isEmail(notifyTo)) {
      return NextResponse.json(
        { ok: false, error: "tenant lead_email not configured" },
        { status: 400 },
      );
    }

    // core fields
    const name = typeof body.name === "string" ? body.name.trim() : null;

    const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";

    const email = emailRaw && isEmail(emailRaw) ? emailRaw : extractEmail(emailRaw) ?? null;
    const phone = phoneRaw ? extractPhone(phoneRaw) ?? phoneRaw : null;

    const preferred_contact: PreferredContact =
      body.preferred_contact === "email" || body.preferred_contact === "phone"
        ? body.preferred_contact
        : null;

    const { first_name, last_name } = splitName(name);

    // metadata (flexible)
    const metadata = safeJson(body.metadata);

    // NEW: appointment fields (prefer explicit fields; fallback to metadata)
    const appointment_topic =
      typeof body.appointment_topic === "string" && body.appointment_topic.trim()
        ? body.appointment_topic.trim()
        : typeof metadata.appointment_topic === "string" && metadata.appointment_topic.trim()
          ? metadata.appointment_topic.trim()
          : null;

    const appointment_window =
      typeof body.appointment_window === "string" && body.appointment_window.trim()
        ? body.appointment_window.trim()
        : typeof metadata.appointment_window === "string" && metadata.appointment_window.trim()
          ? metadata.appointment_window.trim()
          : null;

    // 1) DB Insert (now with explicit columns)
    const { data: inserted, error: insertErr } = await supaAdmin
      .from("leads")
      .insert({
        tenant_id: tenant.id,
        lead_type: leadType,
        preferred_contact,
        name,
        first_name,
        last_name,
        email,
        phone,
        message,
        appointment_topic: leadType === "appointment" ? appointment_topic : null,
        appointment_window: leadType === "appointment" ? appointment_window : null,
        status: "new",
        metadata,
      })
      .select("id, created_at")
      .single();

    if (insertErr || !inserted) {
      console.error("leads insert error:", insertErr);
      return NextResponse.json({ ok: false, error: "db insert failed" }, { status: 500 });
    }

    const leadId = inserted.id as string;
    const createdAtIso = new Date(inserted.created_at as string).toISOString();

    // 2) Email senden
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!resendKey || !from) {
      console.error("Missing RESEND_API_KEY or RESEND_FROM");
      await supaAdmin.from("leads").update({ status: "failed" }).eq("id", leadId);
      return NextResponse.json(
        { ok: false, error: "email not configured on server" },
        { status: 500 },
      );
    }

    const resend = new Resend(resendKey);

    const subject = `[${tenant.name}] ${formatLeadTypeLabel(leadType)} – ${name ?? "Unbekannter Name"}`;

    const html = buildEmailHtml({
      tenantName: tenant.name,
      leadType,
      name,
      first_name,
      last_name,
      email,
      phone,
      preferred_contact,
      message,
      appointment_topic: leadType === "appointment" ? appointment_topic : null,
      appointment_window: leadType === "appointment" ? appointment_window : null,
      createdAtIso,
      leadId,
      slug,
    });

    const mail = await resend.emails.send({
      from,
      to: notifyTo,
      subject,
      html,
    });

    if ((mail as any)?.error) {
      console.error("Resend error:", (mail as any).error);
      await supaAdmin.from("leads").update({ status: "failed" }).eq("id", leadId);
      return NextResponse.json({ ok: false, error: "email send failed" }, { status: 500 });
    }

    await supaAdmin.from("leads").update({ status: "sent" }).eq("id", leadId);

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      email_sent: true,
      message: leadSettings.lead_auto_reply ?? "Vielen Dank! Wir melden uns zeitnah.",
    });
  } catch (e: any) {
    console.error("LEADS API ERROR:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}