"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { authedFetch } from "@/lib/api-client";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

type Wirkung = {
  ok: boolean;
  range: { from: string; to: string; days: number };
  tenant: { hourly_rate_eur: number; avg_handling_time_minutes: number };
  totalConversations: number;
  outsideHoursCount: number;
  outsideHoursPercentage: number;
  totalLeadsFromChat: number;
  conversionRate: number;
  estimatedTimeSavedHours: number;
  estimatedMoneySavedEur: number;
  fallbackRate: number;
  topQuestions: Array<{ question: string; count: number }>;
  topUnansweredQuestions: Array<{ question: string; count: number }>;
  dailyBreakdown: Array<{ date: string; count: number }>;
};

type Preset = "month" | "30" | "90";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "month", label: "Dieser Monat" },
  { key: "30", label: "30 Tage" },
  { key: "90", label: "90 Tage" },
];

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("de-DE");

function hoursText(h: number) {
  if (h < 1) return `${Math.round(h * 60)} Minuten`;
  return `${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Stunden`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

/** Tooltip im CD: Tinte auf Weiß, Haarlinie, Wert in tabular-nums. */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-element border bg-paper px-3 py-2 text-[0.8125rem] shadow-[0_8px_24px_-12px_rgba(15,15,14,0.25)]">
      <p className="text-ink3">{new Date(label).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" })}</p>
      <p className="mt-0.5 font-medium tabular-nums text-ink">
        {num.format(payload[0].value)} {payload[0].value === 1 ? "Gespräch" : "Gespräche"}
      </p>
    </div>
  );
}

export default function WirkungPage() {
  const { tenant } = useAuth();
  const [preset, setPreset] = useState<Preset>("month");
  const [data, setData] = useState<Wirkung | null>(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    const from =
      preset === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getTime() - Number(preset) * 86400_000);
    return { from: from.toISOString(), to: now.toISOString() };
  }, [preset]);

  useEffect(() => {
    if (!tenant) return;
    setData(null);
    setError(false);
    const qs = new URLSearchParams({ tenant_id: tenant.id, from: range.from, to: range.to });
    authedFetch(`/api/dashboard/wirkung?${qs}`)
      .then((r) => r.json())
      .then((json: Wirkung) => (json.ok ? setData(json) : setError(true)))
      .catch(() => setError(true));
  }, [tenant, range.from, range.to]);

  // Der Bericht braucht den Login-Token im Header — ein einfacher Link sendet
  // ihn nicht und liefe in einen 401. Daher per authedFetch laden.
  async function downloadReport() {
    if (!tenant) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const res = await authedFetch(`/api/dashboard/wirkung/report?tenant_id=${encodeURIComponent(tenant.id)}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Monatsbericht-${tenant.slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  const maxTop = Math.max(1, ...(data?.topQuestions.map((q) => q.count) ?? [1]));

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Wirkung"
        description="Was der Assistent für Ihr Team übernommen hat."
        actions={
          <Button variant="secondary" size="sm" onClick={downloadReport} disabled={downloading}>
            <Download size={14} aria-hidden />
            {downloading ? "Wird erstellt …" : "Monatsbericht (PDF)"}
          </Button>
        }
      />

      <div role="tablist" aria-label="Zeitraum" className="inline-flex self-start rounded-full bg-paper2 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            role="tab"
            type="button"
            aria-selected={preset === p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "h-8 rounded-full px-4 text-[0.8125rem] transition-colors duration-150",
              preset === p.key ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink2 hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {downloadError && <ErrorNote>Der Bericht konnte nicht erstellt werden. Bitte versuchen Sie es später erneut.</ErrorNote>}
      {error && <ErrorNote>Die Auswertung konnte nicht geladen werden. Bitte laden Sie die Seite neu.</ErrorNote>}

      {!data && !error ? (
        <LoadingRows rows={5} />
      ) : data && data.totalConversations === 0 ? (
        <EmptyState title="In diesem Zeitraum noch keine Gespräche">
          Sobald Besucher Ihrer Website den Assistenten nutzen, sehen Sie hier, wie viel Arbeit er Ihrem Team abnimmt.
        </EmptyState>
      ) : data ? (
        <>
          <p className="max-w-[44ch] font-display text-[1.75rem] leading-snug text-ink">
            {num.format(data.totalConversations)} Gespräche geführt — rund{" "}
            <span className="text-accent">{hoursText(data.estimatedTimeSavedHours)}</span>, die Ihr Team für anderes hatte.
          </p>

          <dl className="grid grid-cols-2 divide-line border-y md:grid-cols-4 md:divide-x">
            {[
              { label: "eingesparte Kosten", value: eur.format(data.estimatedMoneySavedEur) },
              { label: "außerhalb der Öffnungszeiten", value: `${num.format(data.outsideHoursCount)}`, sub: `${Math.round(data.outsideHoursPercentage)} %` },
              { label: "Anfragen aufgenommen", value: num.format(data.totalLeadsFromChat), sub: `${data.conversionRate.toFixed(0)} % der Gespräche` },
              { label: "ohne Antwort geblieben", value: `${(data.fallbackRate * 100).toFixed(0)} %`, sub: "der Nachrichten" },
            ].map((s) => (
              <div key={s.label} className="py-5 md:px-6 md:first:pl-0">
                <dd className="text-[1.375rem] font-medium tabular-nums text-ink">{s.value}</dd>
                <dt className="mt-1 text-[0.8125rem] text-ink2">
                  {s.label}
                  {s.sub && <span className="text-ink3"> · {s.sub}</span>}
                </dt>
              </div>
            ))}
          </dl>
          <p className="-mt-6 text-xs text-ink3">
            Berechnet mit {data.tenant.avg_handling_time_minutes} Minuten je Anfrage und {eur.format(data.tenant.hourly_rate_eur)} pro
            Stunde —{" "}
            <Link href="/dashboard/settings" className="underline underline-offset-4 hover:text-ink">
              anpassen
            </Link>
            .
          </p>

          <Section title="Gespräche pro Tag">
            <div className="h-64 w-full" role="img" aria-label={`Gespräche pro Tag, insgesamt ${data.totalConversations}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailyBreakdown} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="rgba(15,15,14,0.06)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "#666a67", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(15,15,14,0.1)" }}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: "#666a67", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(15,15,14,0.2)", strokeWidth: 1 }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1a5c3a"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#1a5c3a", stroke: "#fcfdfc", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div className="grid gap-12 lg:grid-cols-2">
            <Section title="Häufigste Anliegen">
              {data.topQuestions.length === 0 ? (
                <p className="text-sm text-ink3">Noch zu wenige Gespräche für eine Auswertung.</p>
              ) : (
                <ol className="divide-y border-y">
                  {data.topQuestions.slice(0, 8).map((q) => (
                    <li key={q.question} className="py-3">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="min-w-0 truncate text-ink" title={q.question}>{q.question}</span>
                        <span className="shrink-0 tabular-nums text-ink2">{q.count}×</span>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-paper3" aria-hidden>
                        <div className="h-1 rounded-full bg-accent" style={{ width: `${(q.count / maxTop) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Wissenslücken" hint="Fragen ohne Antwort">
              {data.topUnansweredQuestions.length === 0 ? (
                <p className="text-sm text-ink3">Keine offenen Fragen in diesem Zeitraum.</p>
              ) : (
                <ul className="divide-y border-y">
                  {data.topUnansweredQuestions.slice(0, 8).map((q) => (
                    <li key={q.question} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                      <span className="min-w-0 text-ink">
                        „{q.question}“{q.count > 1 && <span className="ml-2 tabular-nums text-ink3">{q.count}×</span>}
                      </span>
                      <Link
                        href={`/dashboard/knowledge?frage=${encodeURIComponent(q.question)}`}
                        className="shrink-0 text-[0.8125rem] font-medium text-accent hover:underline underline-offset-4"
                      >
                        Antwort ergänzen
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      ) : null}
    </div>
  );
}
