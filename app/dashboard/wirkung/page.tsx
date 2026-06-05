"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { authedFetch } from "@/lib/api-client";
import { t as theme, topbar as topbarStyle, DashboardShell } from "@/lib/dashboardTheme";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";

type Wirkung = {
  ok: boolean;
  range: { from: string; to: string; days: number };
  tenant: {
    id: string;
    name: string;
    hourly_rate_eur: number;
    avg_handling_time_minutes: number;
  };
  totalConversations: number;
  outsideHoursCount: number;
  outsideHoursPercentage: number;
  totalLeadsFromChat: number;
  conversionRate: number;
  estimatedTimeSavedHours: number;
  estimatedMoneySavedEur: number;
  avgSimilarity: number;
  fallbackRate: number;
  topQuestions: Array<{ question: string; count: number }>;
  topUnansweredQuestions: Array<{ question: string; count: number }>;
  weekOverWeek: { thisWeek: number; lastWeek: number; changePercent: number };
  monthProjection: number;
  dailyBreakdown: Array<{ date: string; count: number }>;
};

type RangePreset = "week" | "month" | "30" | "90";

const RANGE_PRESETS: Array<{ key: RangePreset; label: string; days: number }> = [
  { key: "week", label: "Diese Woche", days: 7 },
  { key: "month", label: "Diesen Monat", days: 30 },
  { key: "30", label: "Letzte 30 Tage", days: 30 },
  { key: "90", label: "Letzte 90 Tage", days: 90 },
];

function fmtEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtHours(n: number) {
  if (n < 1) return `${(n * 60).toFixed(0)} Min`;
  return `${n.toFixed(1)} h`;
}

function fmtPct(n: number) {
  return `${n.toFixed(0)} %`;
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

const colors = {
  bg: theme.bg,
  surface: "rgba(255,255,255,0.55)",
  surfaceSolid: "rgba(255,255,255,0.96)", // für Tooltips (undurchsichtig)
  track: "rgba(18,30,22,0.08)",
  barSecondary: "rgba(18,30,22,0.16)",
  border: theme.border,
  borderStrong: theme.borderStrong,
  text: theme.text,
  muted: theme.textMuted,
  subtle: theme.textSecondary,
  green: theme.greenAccent,
  greenSoft: theme.greenSoft,
  greenBorder: theme.greenBorder,
  amber: theme.amber,
  amberSoft: theme.amberSoft,
  amberBorder: theme.amberBorder,
};

const IconMessage = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 3h12v8a1 1 0 01-1 1H7l-3 3v-3H3a1 1 0 01-1-1V3z" />
  </svg>
);
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6.5" /><path d="M8 4v4l2.5 2" />
  </svg>
);
const IconEuro = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 4a4 4 0 100 8M2 7h7M2 9h7" />
  </svg>
);
const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12.5 9.5A5 5 0 016.5 3.5a5 5 0 106 6z" />
  </svg>
);
const IconSpark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />
  </svg>
);

function KpiCard({
  label,
  value,
  hint,
  trend,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { label: string; positive: boolean } | null;
  Icon: () => React.JSX.Element;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 140,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, color: colors.muted, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
          {label}
        </p>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: accent ? colors.greenSoft : "rgba(18,30,22,0.05)",
            color: accent ? colors.green : colors.subtle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon />
        </div>
      </div>
      <p style={{ fontSize: 34, fontWeight: 600, color: colors.text, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {hint && <p style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.4 }}>{hint}</p>}
        {trend && (
          <p style={{ fontSize: 12, color: trend.positive ? colors.green : colors.amber, fontWeight: 500 }}>
            {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}

function Skeleton({ h = 120 }: { h?: number }) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        height: h,
      }}
      className="animate-pulse"
    />
  );
}

export default function WirkungPage() {
  const { tenant, role, loading: authLoading } = useAuth();
  const [preset, setPreset] = useState<RangePreset>("30");
  const [data, setData] = useState<Wirkung | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    let from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (preset === "week") from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (preset === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (preset === "30") from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (preset === "90") from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: now.toISOString() };
  }, [preset]);

  useEffect(() => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      tenant_id: tenant.id,
      from: range.from,
      to: range.to,
    }).toString();
    authedFetch(`/api/dashboard/wirkung?${qs}`)
      .then((r) => r.json())
      .then((json: Wirkung & { ok: boolean; error?: string }) => {
        if (!json.ok) {
          setError(json.error || "Daten konnten nicht geladen werden");
          setData(null);
        } else {
          setData(json);
        }
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [tenant?.id, range.from, range.to]);

  if (authLoading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: colors.muted, fontSize: 13 }}>Wird geladen…</p>
      </div>
    );
  }

  const totalConv = data?.totalConversations ?? 0;
  const isEmpty = !loading && data !== null && totalConv === 0;

  // Trend label vs. previous week (week-over-week)
  const wow = data?.weekOverWeek;
  const wowTrend =
    wow && (wow.thisWeek > 0 || wow.lastWeek > 0)
      ? {
          label:
            wow.lastWeek === 0
              ? `+${wow.thisWeek} ggü. Vorwoche`
              : `${wow.changePercent >= 0 ? "+" : ""}${wow.changePercent.toFixed(0)} % ggü. Vorwoche`,
          positive: wow.changePercent >= 0,
        }
      : null;

  const workDays = data ? data.estimatedTimeSavedHours / 8 : 0;

  return (
    <DashboardShell sidebar={<Sidebar role={role} tenantName={tenant?.name} />}>
        {/* Header */}
        <div
          style={{
            ...topbarStyle,
            padding: "20px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontSize: 24,
                color: colors.text,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              Wirkung
            </p>
            <p style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
              Was Ihr digitaler Assistent für Sie geleistet hat
            </p>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {tenant?.id && data && data.totalConversations > 0 && (
              <a
                href={`/api/dashboard/wirkung/report?tenant_id=${tenant.id}`}
                style={{
                  fontSize: 12.5,
                  padding: "7px 13px",
                  borderRadius: 6,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.subtle,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginRight: 8,
                }}
                title="Monatsbericht für den Vormonat als PDF herunterladen"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2v9M5 8l3 3 3-3M3 14h10" />
                </svg>
                Monatsbericht
              </a>
            )}
            {RANGE_PRESETS.map((p) => {
              const active = p.key === preset;
              return (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  style={{
                    fontSize: 12.5,
                    padding: "7px 13px",
                    borderRadius: 6,
                    border: `1px solid ${active ? colors.green : colors.border}`,
                    background: active ? colors.greenSoft : colors.surface,
                    color: active ? colors.green : colors.subtle,
                    fontWeight: active ? 500 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
          {error && (
            <div
              style={{
                background: colors.amberSoft,
                border: `1px solid ${colors.border}`,
                color: colors.amber,
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {loading && !data ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <Skeleton h={140} /><Skeleton h={140} /><Skeleton h={140} /><Skeleton h={140} />
              </div>
              <Skeleton h={260} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Skeleton h={260} /><Skeleton h={260} />
              </div>
            </>
          ) : isEmpty ? (
            <EmptyState />
          ) : data ? (
            <>
              {/* KPI Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <KpiCard
                  label="Abgefangene Anfragen"
                  value={String(data.totalConversations)}
                  hint="Konversationen im gewählten Zeitraum"
                  trend={wowTrend}
                  Icon={IconMessage}
                  accent
                />
                <KpiCard
                  label="Zeitersparnis für Ihr Team"
                  value={fmtHours(data.estimatedTimeSavedHours)}
                  hint={
                    workDays >= 0.25
                      ? `Etwa ${workDays.toFixed(workDays >= 1 ? 1 : 2)} Arbeitstag${workDays >= 2 ? "e" : ""} à 8 Stunden`
                      : `Bei Ø ${data.tenant.avg_handling_time_minutes} Min. pro Anfrage`
                  }
                  Icon={IconClock}
                />
                <KpiCard
                  label="Eingesparte Kosten"
                  value={fmtEUR(data.estimatedMoneySavedEur)}
                  hint={`Basierend auf Ihrem Stundensatz von ${fmtEUR(data.tenant.hourly_rate_eur)}`}
                  Icon={IconEuro}
                />
                <KpiCard
                  label="Außerhalb Öffnungszeiten"
                  value={String(data.outsideHoursCount)}
                  hint={
                    data.outsideHoursCount > 0
                      ? `${fmtPct(data.outsideHoursPercentage)} aller Anfragen — Kunden, die sonst zur Konkurrenz gegangen wären`
                      : "Alle Anfragen kamen während Ihrer Öffnungszeiten"
                  }
                  Icon={IconMoon}
                />
              </div>

              {/* Daily chart */}
              <div
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: "20px 22px",
                }}
              >
                <p style={{ fontSize: 13, color: colors.muted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
                  Anfragen pro Tag
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-instrument-serif), Georgia, serif",
                    fontSize: 20,
                    color: colors.text,
                    marginBottom: 16,
                  }}
                >
                  Verlauf über {data.range.days} Tage
                </p>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={data.dailyBreakdown.map((d) => ({ ...d, label: fmtShortDate(d.date) }))}
                      margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid stroke={colors.border} vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke={colors.muted}
                        fontSize={11}
                        tickMargin={8}
                        minTickGap={24}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke={colors.muted}
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{
                          background: colors.surfaceSolid,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: colors.text,
                        }}
                        labelStyle={{ color: colors.muted, fontSize: 11 }}
                        formatter={(v) => [Number(v), "Anfragen"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={colors.green}
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: colors.green, strokeWidth: 0 }}
                        activeDot={{ r: 4.5, fill: colors.green }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two-column: Top questions + Quality */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                <div
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: "20px 22px",
                  }}
                >
                  <p style={{ fontSize: 13, color: colors.muted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
                    Häufigste Fragen
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-instrument-serif), Georgia, serif",
                      fontSize: 20,
                      color: colors.text,
                      marginBottom: 16,
                    }}
                  >
                    Was Kunden beschäftigt
                  </p>
                  {data.topQuestions.length === 0 ? (
                    <p style={{ fontSize: 13, color: colors.muted }}>Noch nicht genug Daten.</p>
                  ) : (
                    <div style={{ width: "100%", height: 200 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={data.topQuestions.map((q) => ({
                            ...q,
                            shortQ: q.question.length > 38 ? q.question.slice(0, 36) + "…" : q.question,
                          }))}
                          layout="vertical"
                          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                        >
                          <XAxis type="number" hide allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="shortQ"
                            stroke={colors.subtle}
                            fontSize={12}
                            width={180}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(18,30,22,0.05)" }}
                            contentStyle={{
                              background: colors.surfaceSolid,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 6,
                              fontSize: 12,
                              color: colors.text,
                            }}
                            formatter={(v) => [Number(v), "Mal gestellt"]}
                            labelFormatter={(_, payload) =>
                              (payload?.[0]?.payload as any)?.question ?? ""
                            }
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {data.topQuestions.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? colors.green : colors.barSecondary} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <p style={{ fontSize: 13, color: colors.muted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
                    Antwortqualität
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-instrument-serif), Georgia, serif",
                      fontSize: 20,
                      color: colors.text,
                      marginBottom: 20,
                    }}
                  >
                    Wie sicher der Assistent antwortet
                  </p>

                  <QualityRow
                    label="Treffsicherheit der Antworten"
                    value={`${(data.avgSimilarity * 100).toFixed(0)} %`}
                    bar={data.avgSimilarity}
                    color={colors.green}
                  />
                  <QualityRow
                    label="Konversionsrate zu Leads"
                    value={`${data.conversionRate.toFixed(1)} %`}
                    bar={data.conversionRate / 100}
                    color={colors.green}
                    hint={`${data.totalLeadsFromChat} Leads aus ${data.totalConversations} Gesprächen`}
                  />
                  <QualityRow
                    label="Fallback-Rate"
                    value={`${(data.fallbackRate * 100).toFixed(1)} %`}
                    bar={data.fallbackRate}
                    color={colors.amber}
                    hint="Anteil der Nachrichten ohne klare Antwort — niedriger ist besser"
                  />
                </div>
              </div>

              {/* Unanswered questions — KB-update incentive */}
              {data.topUnansweredQuestions && data.topUnansweredQuestions.length > 0 && (
                <div
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: "20px 22px",
                  }}
                >
                  <p style={{ fontSize: 13, color: colors.amber, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
                    Wissenslücken
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-instrument-serif), Georgia, serif",
                      fontSize: 20,
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    Diese Fragen konnte Ihr Assistent nicht beantworten
                  </p>
                  <p style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 1.5, maxWidth: 620 }}>
                    Ergänzen Sie diese Themen in Ihrer{" "}
                    <a href="/dashboard/knowledge" style={{ color: colors.green, fontWeight: 500 }}>Wissensbasis</a>
                    {" "}— dann beantwortet der Bot sie ab sofort automatisch und fängt noch mehr Anfragen ab.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.topUnansweredQuestions.map((q, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          background: colors.amberSoft,
                          border: `1px solid ${colors.amberBorder}`,
                          borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: 13.5, color: colors.text, flex: 1, minWidth: 0 }}>
                          {q.question}
                        </span>
                        <span style={{ fontSize: 12.5, color: colors.amber, fontWeight: 600, flexShrink: 0 }}>
                          {q.count}× gefragt
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projection banner */}
              {data.monthProjection > 0 && (
                <div
                  style={{
                    background: colors.greenSoft,
                    border: `1px solid ${colors.greenBorder}`,
                    borderRadius: 12,
                    padding: "22px 26px",
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: "#ffffff",
                      color: colors.green,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconSpark />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-instrument-serif), Georgia, serif",
                        fontSize: 22,
                        color: colors.text,
                        lineHeight: 1.25,
                        marginBottom: 8,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Bei diesem Tempo werden wir diesen Monat{" "}
                      <span style={{ color: colors.green }}>{data.monthProjection} Anfragen</span> für Sie bearbeiten.
                    </p>
                    <p style={{ fontSize: 14, color: colors.subtle, lineHeight: 1.5 }}>
                      Das spart Ihrem Team voraussichtlich{" "}
                      <strong style={{ color: colors.text }}>
                        {fmtHours((data.monthProjection * data.tenant.avg_handling_time_minutes) / 60)}
                      </strong>{" "}
                      Arbeitszeit und{" "}
                      <strong style={{ color: colors.text }}>
                        {fmtEUR(
                          ((data.monthProjection * data.tenant.avg_handling_time_minutes) / 60) *
                            data.tenant.hourly_rate_eur
                        )}
                      </strong>{" "}
                      Personalkosten.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
    </DashboardShell>
  );
}

function QualityRow({
  label,
  value,
  bar,
  color,
  hint,
}: {
  label: string;
  value: string;
  bar: number;
  color: string;
  hint?: string;
}) {
  const pct = Math.max(0, Math.min(1, bar)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <p style={{ fontSize: 13, color: colors.subtle }}>{label}</p>
        <p style={{ fontSize: 15, color: colors.text, fontWeight: 500 }}>{value}</p>
      </div>
      <div style={{ height: 6, background: colors.track, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
      </div>
      {hint && <p style={{ fontSize: 11.5, color: colors.muted, marginTop: 6, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: "64px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: colors.greenSoft,
          color: colors.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 17l5-5 4 4 8-8M14 5h7v7" />
        </svg>
      </div>
      <p
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 24,
          color: colors.text,
          lineHeight: 1.2,
        }}
      >
        Hier sehen Sie bald Ihre Wirkung.
      </p>
      <p style={{ fontSize: 14, color: colors.muted, maxWidth: 420, lineHeight: 1.5 }}>
        Sobald Ihr Chatbot erste Gespräche geführt hat, zeigen wir Ihnen, wie viel Zeit und Geld er Ihrem Team spart —
        und welche Fragen Ihre Kunden wirklich beschäftigen.
      </p>
    </div>
  );
}
