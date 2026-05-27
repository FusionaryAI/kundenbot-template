import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

type AnalyticsRow = {
  conversation_id: string;
  started_at: string;
  message_count: number | null;
  outside_business_hours: boolean | null;
  resulted_in_lead: boolean | null;
  avg_similarity: number | null;
  first_user_message: string | null;
  fallback_count: number | null;
  similarity_samples: number | null;
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/[?!.,;:]+$/g, "").replace(/\s+/g, " ");
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }

    // Default: last full calendar month. Override via ?month=YYYY-MM (e.g. 2026-04).
    const now = new Date();
    const monthParam = url.searchParams.get("month");
    let year: number;
    let month: number; // 0-indexed
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      year = y;
      month = m - 1;
    } else {
      // Previous full month
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      year = prev.getFullYear();
      month = prev.getMonth();
    }
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0, 23, 59, 59);

    // Tenant
    const { data: tenant, error: tenantErr } = await supaAdmin
      .from("tenants")
      .select("id, name, hourly_rate_eur, avg_handling_time_minutes")
      .eq("id", tenantId)
      .single();
    if (tenantErr || !tenant) {
      return NextResponse.json({ ok: false, error: "tenant not found" }, { status: 404 });
    }

    const hourlyRate = Number(tenant.hourly_rate_eur ?? 35);
    const handlingMinutes = Number(tenant.avg_handling_time_minutes ?? 4);

    const { data: rows, error: rowsErr } = await supaAdmin
      .from("conversation_analytics")
      .select(
        "conversation_id, started_at, message_count, outside_business_hours, resulted_in_lead, avg_similarity, first_user_message, fallback_count, similarity_samples"
      )
      .eq("tenant_id", tenantId)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString())
      .order("started_at", { ascending: true })
      .limit(10000);

    if (rowsErr) {
      console.error("[wirkung/report] rows error:", rowsErr);
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const data: AnalyticsRow[] = rows ?? [];
    const totalConversations = data.length;
    const outsideHoursCount = data.filter((r) => r.outside_business_hours === true).length;
    const totalLeadsFromChat = data.filter((r) => r.resulted_in_lead === true).length;
    const estimatedTimeSavedHours = (totalConversations * handlingMinutes) / 60;
    const estimatedMoneySavedEur = estimatedTimeSavedHours * hourlyRate;

    // Top questions
    const counts = new Map<string, { question: string; count: number }>();
    for (const r of data) {
      const q = (r.first_user_message ?? "").trim();
      if (!q) continue;
      const key = normalizeQuestion(q);
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { question: q, count: 1 });
    }
    const topQuestions = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    // Daily breakdown
    const dailyMap = new Map<string, number>();
    for (const r of data) {
      const day = isoDay(new Date(r.started_at));
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const dailyBreakdown: Array<{ date: string; count: number }> = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = isoDay(d);
      dailyBreakdown.push({ date: key, count: dailyMap.get(key) ?? 0 });
    }

    const monthLabel = `${MONTH_NAMES[month]} ${year}`;
    const generatedAt = now.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Render PDF. Dynamic import keeps @react-pdf out of the cold-start path
    // for routes that never need it.
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { MonthlyReport } = await import("@/lib/pdf/MonthlyReport");
    const { createElement } = await import("react");

    const element = createElement(MonthlyReport, {
      data: {
        tenantName: tenant.name,
        monthLabel,
        generatedAt,
        totalConversations,
        estimatedTimeSavedHours,
        estimatedMoneySavedEur,
        outsideHoursCount,
        totalLeadsFromChat,
        topQuestions,
        dailyBreakdown,
      },
    });

    const buffer = await renderToBuffer(element as any);

    const safeName = tenant.name.replace(/[^\w\s\-äöüÄÖÜß]/g, "").replace(/\s+/g, "-");
    const filename = `Wirkungsbericht-${safeName}-${monthLabel.replace(" ", "-")}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[wirkung/report] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}
