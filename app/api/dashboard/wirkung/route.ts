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

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/[?!.,;:]+$/g, "").replace(/\s+/g, " ");
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = parseDate(url.searchParams.get("from"), defaultFrom);
    const to = parseDate(url.searchParams.get("to"), now);

    // Tenant config for ROI calculation
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

    // Fetch raw analytics rows for the range. Single query, then aggregate in JS.
    // v1 trade-off: fine for tenants with up to a few thousand rows/range.
    const { data: rows, error: rowsErr } = await supaAdmin
      .from("conversation_analytics")
      .select(
        "conversation_id, started_at, message_count, outside_business_hours, resulted_in_lead, avg_similarity, first_user_message, fallback_count, similarity_samples"
      )
      .eq("tenant_id", tenantId)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString())
      .order("started_at", { ascending: false })
      .limit(5000);

    if (rowsErr) {
      console.error("[wirkung] rows error:", rowsErr);
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const data: AnalyticsRow[] = rows ?? [];
    const totalConversations = data.length;

    // KPI aggregates
    const outsideHoursCount = data.filter((r) => r.outside_business_hours === true).length;
    const outsideHoursPercentage =
      totalConversations > 0 ? (outsideHoursCount / totalConversations) * 100 : 0;

    const totalLeadsFromChat = data.filter((r) => r.resulted_in_lead === true).length;
    const conversionRate =
      totalConversations > 0 ? (totalLeadsFromChat / totalConversations) * 100 : 0;

    const estimatedTimeSavedHours = (totalConversations * handlingMinutes) / 60;
    const estimatedMoneySavedEur = estimatedTimeSavedHours * hourlyRate;

    // Quality: weighted avg of avg_similarity by similarity_samples
    let simWeightedSum = 0;
    let simWeightTotal = 0;
    let fallbackTotal = 0;
    let messageTotal = 0;
    for (const r of data) {
      const samples = Number(r.similarity_samples ?? 0);
      const avg = Number(r.avg_similarity ?? 0);
      if (samples > 0) {
        simWeightedSum += avg * samples;
        simWeightTotal += samples;
      }
      fallbackTotal += Number(r.fallback_count ?? 0);
      messageTotal += Number(r.message_count ?? 0);
    }
    const avgSimilarity = simWeightTotal > 0 ? simWeightedSum / simWeightTotal : 0;
    const fallbackRate = messageTotal > 0 ? fallbackTotal / messageTotal : 0;

    // Top questions — v1: exact-match group by normalized first user message
    const questionCounts = new Map<string, { question: string; count: number }>();
    for (const r of data) {
      const q = (r.first_user_message ?? "").trim();
      if (!q) continue;
      const key = normalizeQuestion(q);
      if (!key) continue;
      const existing = questionCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        questionCounts.set(key, { question: q, count: 1 });
      }
    }
    const topQuestions = [...questionCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily breakdown
    const dailyMap = new Map<string, number>();
    for (const r of data) {
      const day = isoDay(new Date(r.started_at));
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    // Fill missing days with 0
    const dailyBreakdown: Array<{ date: string; count: number }> = [];
    const fromDay = startOfDayUTC(from);
    const toDay = startOfDayUTC(to);
    for (let d = new Date(fromDay); d <= toDay; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = isoDay(d);
      dailyBreakdown.push({ date: key, count: dailyMap.get(key) ?? 0 });
    }

    // Week over week: compare last 7 days vs the 7 days before that, anchored to `to`
    const oneDay = 24 * 60 * 60 * 1000;
    const thisWeekStart = new Date(to.getTime() - 7 * oneDay);
    const lastWeekStart = new Date(to.getTime() - 14 * oneDay);
    let thisWeek = 0;
    let lastWeek = 0;
    for (const r of data) {
      const t = new Date(r.started_at).getTime();
      if (t >= thisWeekStart.getTime() && t <= to.getTime()) thisWeek += 1;
      else if (t >= lastWeekStart.getTime() && t < thisWeekStart.getTime()) lastWeek += 1;
    }
    const changePercent = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

    // Month projection: extrapolate current daily rate to the calendar month
    const rangeDays = daysBetween(from, to);
    const daysInCurrentMonth = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      0
    ).getUTCDate();
    const monthProjection =
      rangeDays > 0 ? Math.round((totalConversations / rangeDays) * daysInCurrentMonth) : 0;

    return NextResponse.json({
      ok: true,
      range: { from: from.toISOString(), to: to.toISOString(), days: rangeDays },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        hourly_rate_eur: hourlyRate,
        avg_handling_time_minutes: handlingMinutes,
      },
      totalConversations,
      outsideHoursCount,
      outsideHoursPercentage,
      totalLeadsFromChat,
      conversionRate,
      estimatedTimeSavedHours,
      estimatedMoneySavedEur,
      avgSimilarity,
      fallbackRate,
      topQuestions,
      weekOverWeek: { thisWeek, lastWeek, changePercent },
      monthProjection,
      dailyBreakdown,
    });
  } catch (e: any) {
    console.error("[wirkung] error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}
