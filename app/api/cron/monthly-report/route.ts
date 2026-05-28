import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";
// Allow up to 5 min — generating + sending many PDFs can take a while.
export const maxDuration = 300;

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function baseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  return explicit || vercel || "http://localhost:3000";
}

/**
 * Monthly Wirkungsbericht cron.
 *
 * Scheduled via vercel.json: "0 7 1 * *" → 1st of month, 07:00 UTC (≈09:00
 * Berlin im Sommer / 08:00 im Winter wegen DST).
 *
 * STATUS: VORBEREITET, VERSAND DEAKTIVIERT.
 * Der eigentliche Resend-Versand ist auskommentiert. Die Route iteriert
 * aktive Tenants, holt das PDF vom bestehenden Report-Endpoint und LOGGT,
 * was sie senden würde. Zum Aktivieren: den markierten Block einkommentieren
 * + RESEND_API_KEY/RESEND_FROM/CRON_SECRET in Vercel setzen.
 */
export async function GET(req: NextRequest) {
  // --- Auth: Vercel Cron sendet "Authorization: Bearer <CRON_SECRET>" ---
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  // If CRON_SECRET is unset we still run (e.g. manual trigger in dev), but log a warning.
  if (!cronSecret) {
    console.warn("[cron/monthly-report] CRON_SECRET not set — route is unprotected.");
  }

  // --- Zeitraum: voriger voller Kalendermonat ---
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = prev.getMonth(); // 0-indexed
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const monthParam = `${year}-${String(month + 1).padStart(2, "0")}`;

  // --- Aktive Tenants mit hinterlegter Empfänger-Mail ---
  // Wir nehmen tenant_settings.lead_email als Empfänger (gleiches Feld wie
  // Lead-Benachrichtigungen). Tenants ohne Mail werden übersprungen.
  const { data: tenants, error: tenantsErr } = await supaAdmin
    .from("tenants")
    .select("id, name, slug");

  if (tenantsErr) {
    console.error("[cron/monthly-report] tenants error:", tenantsErr);
    return NextResponse.json({ ok: false, error: "tenants query failed" }, { status: 500 });
  }

  const results: Array<{
    tenant: string;
    status: "would-send" | "skipped-no-email" | "skipped-no-data" | "error";
    detail?: string;
  }> = [];

  for (const tenant of tenants ?? []) {
    try {
      // Empfänger-Mail holen
      const { data: settings } = await supaAdmin
        .from("tenant_settings")
        .select("lead_email")
        .eq("tenant_id", tenant.id)
        .single();

      const recipient = settings?.lead_email?.trim() || null;
      if (!recipient) {
        results.push({ tenant: tenant.name, status: "skipped-no-email" });
        continue;
      }

      // Quick-Check: gab es im Vormonat überhaupt Konversationen?
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const { count } = await supaAdmin
        .from("conversation_analytics")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("started_at", from)
        .lte("started_at", to);

      if (!count || count === 0) {
        results.push({ tenant: tenant.name, status: "skipped-no-data" });
        continue;
      }

      // PDF vom bestehenden Report-Endpoint holen (kein Code-Duplikat)
      const reportUrl = `${baseUrl()}/api/dashboard/wirkung/report?tenant_id=${tenant.id}&month=${monthParam}`;
      const pdfRes = await fetch(reportUrl);
      if (!pdfRes.ok) {
        results.push({ tenant: tenant.name, status: "error", detail: `report ${pdfRes.status}` });
        continue;
      }
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

      // ============================================================
      // VERSAND — AKTUELL DEAKTIVIERT.
      // Zum Aktivieren: Block einkommentieren + ENV-Vars in Vercel setzen.
      // ============================================================
      //
      // const { Resend } = await import("resend");
      // const resend = new Resend(process.env.RESEND_API_KEY!);
      // await resend.emails.send({
      //   from: process.env.RESEND_FROM!,
      //   to: recipient,
      //   subject: `Ihre Wirkungsbilanz für ${monthLabel}`,
      //   html: `
      //     <p>Guten Tag,</p>
      //     <p>anbei Ihr Wirkungsbericht für <strong>${monthLabel}</strong> —
      //     eine Übersicht, was Ihr digitaler Assistent im letzten Monat
      //     für Sie geleistet hat.</p>
      //     <p>Herzliche Grüße<br/>Ihr Fusionary AI Team</p>
      //   `,
      //   text: `Anbei Ihr Wirkungsbericht für ${monthLabel}. Ihr Fusionary AI Team`,
      //   attachments: [
      //     {
      //       filename: `Wirkungsbericht-${monthLabel.replace(" ", "-")}.pdf`,
      //       content: pdfBuffer,
      //     },
      //   ],
      // });
      // ============================================================

      console.log(
        `[cron/monthly-report] WOULD SEND to ${recipient} for "${tenant.name}" ` +
          `(${monthLabel}, PDF ${pdfBuffer.length} bytes)`
      );
      results.push({
        tenant: tenant.name,
        status: "would-send",
        detail: `${recipient} · ${pdfBuffer.length}b`,
      });
    } catch (e: any) {
      console.error(`[cron/monthly-report] error for ${tenant.name}:`, e);
      results.push({ tenant: tenant.name, status: "error", detail: e?.message });
    }
  }

  const summary = {
    ok: true,
    month: monthLabel,
    sendingEnabled: false, // flip when the Resend block is uncommented
    processed: results.length,
    wouldSend: results.filter((r) => r.status === "would-send").length,
    skippedNoEmail: results.filter((r) => r.status === "skipped-no-email").length,
    skippedNoData: results.filter((r) => r.status === "skipped-no-data").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };

  console.log("[cron/monthly-report] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
