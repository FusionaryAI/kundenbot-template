import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { Resend } from "resend";

export const runtime = "nodejs";

type LeadType = "contact" | "appointment" | "callback";

/**
 * Lazy Resend Initialisierung
 * → verhindert Build-Fehler, wenn ENV beim Build fehlt
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing");
  }
  return new Resend(apiKey);
}

// --------------------
// Helpers
// --------------------

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

  return data;
}

async function getTenantSettings(tenantId: string) {
  const { data, error } = await supaAdmin
    .from("tenant_settings")
    .select("lead_enabled, lead_email")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    return {
      lead_enabled: false,
      lead_email: null,
    };
  }

  return data as {
    lead_enabled: boolean | null;
    lead_email: string | null;
  };
}

// --------------------
// POST /api/leads
// --------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      slug,
      type,
      name,
      email,
      phone,
      message,
      metadata,
    }: {
      slug: string;
      type: LeadType;
      name?: string;
      email?: string;
      phone?: string;
      message: string;
      metadata?: any;
    } = body;

    // --- Minimal-Validation ---
    if (!slug || !type || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // --- Tenant & Settings ---
    const tenant = await getTenantBySlug(slug);
    const settings = await getTenantSettings(tenant.id);

    // ------------------------------------------------
    // 1) LEAD IMMER SPEICHERN (Single Source of Truth)
    // ------------------------------------------------
    const { data: lead, error: insertError } = await supaAdmin
      .from("leads")
      .insert({
        tenant_id: tenant.id,
        type,
        name,
        email,
        phone,
        message,
        metadata: metadata ?? {},
        delivery_status: "pending",
      })
      .select("*")
      .single();

    if (insertError || !lead) {
      console.error("Lead insert failed:", insertError);
      throw new Error("Lead insert failed");
    }

    // ------------------------------------------------
    // 2) E-MAIL VERSUCHEN (optional)
    // ------------------------------------------------
    let emailSent = false;
    let emailError: string | null = null;

    if (settings.lead_enabled !== false && settings.lead_email) {
      try {
        const from = process.env.RESEND_FROM;
        if (!from) {
          throw new Error("RESEND_FROM is missing");
        }

        const resend = getResendClient();

        await resend.emails.send({
          from,
          to: settings.lead_email,
          subject: `Neue Anfrage (${type})`,
          text: `
Neue Anfrage über den Website-Chat

Typ: ${type}
Name: ${name ?? "-"}
E-Mail: ${email ?? "-"}
Telefon: ${phone ?? "-"}
Nachricht:
${message}
          `.trim(),
        });

        emailSent = true;

        await supaAdmin
          .from("leads")
          .update({
            delivery_status: "sent",
            delivered_at: new Date().toISOString(),
            delivery_error: null,
          })
          .eq("id", lead.id);
      } catch (e: any) {
        emailError = e?.message ?? "Email send failed";

        await supaAdmin
          .from("leads")
          .update({
            delivery_status: "failed",
            delivery_error: emailError,
          })
          .eq("id", lead.id);
      }
    }

    // ------------------------------------------------
    // 3) IMMER OK ZURÜCK (User bekommt Ruhe)
    // ------------------------------------------------
    return NextResponse.json({
      ok: true,
      lead_id: lead.id,
      email_sent: emailSent,
      message: "Vielen Dank! Wir melden uns zeitnah.",
    });
  } catch (e: any) {
    console.error("POST /api/leads error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}