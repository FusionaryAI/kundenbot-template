"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, Copy, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink, Button } from "@/components/ui/Button";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { leadStatusLabel, leadStatusTone, leadTypeLabel, relativeTime, telHref } from "@/lib/lead-format";

type OpenLead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
};

type QuestionGroup = { text: string; count: number; last: string };

type MonthStats = { conversations: number; leads: number; outsideHours: number };

/** Gleiche Fragen zusammenfassen (Groß-/Kleinschreibung, Satzzeichen). */
function groupQuestions(rows: { question: string; created_at: string }[]): QuestionGroup[] {
  const map = new Map<string, QuestionGroup>();
  for (const r of rows) {
    const key = r.question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    if (!key) continue;
    const g = map.get(key);
    if (g) {
      g.count++;
      if (r.created_at > g.last) g.last = r.created_at;
    } else {
      map.set(key, { text: r.question.trim(), count: 1, last: r.created_at });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

export default function OverviewPage() {
  const { tenant } = useAuth();
  const [leads, setLeads] = useState<OpenLead[] | null>(null);
  const [questions, setQuestions] = useState<QuestionGroup[] | null>(null);
  const [stats, setStats] = useState<MonthStats | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const tenantId = tenant.id;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();

    Promise.all([
      supabase
        .from("leads")
        .select("id, name, phone, email, message, type, status, created_at")
        .eq("tenant_id", tenantId)
        .in("status", ["neu", "in_bearbeitung"])
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("unanswered_questions")
        .select("question, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("conversation_analytics")
        .select("outside_business_hours")
        .eq("tenant_id", tenantId)
        .gte("started_at", monthStart),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", monthStart),
    ]).then(([open, unanswered, convs, monthLeads]) => {
      setLeads((open.data as OpenLead[]) ?? []);
      setQuestions(groupQuestions(unanswered.data ?? []).slice(0, 6));
      const rows = convs.data ?? [];
      setStats({
        conversations: rows.length,
        leads: monthLeads.count ?? 0,
        outsideHours: rows.filter((r) => r.outside_business_hours).length,
      });
    });
  }, [tenant]);

  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const newCount = leads?.filter((l) => l.status === "neu").length ?? 0;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={today}
        title={greeting()}
        description={
          leads === null
            ? "Einen Moment, wir sehen nach, was ansteht."
            : newCount > 0
              ? `${newCount === 1 ? "Eine neue Anfrage wartet" : `${newCount} neue Anfragen warten`} auf Rückmeldung.`
              : "Keine neuen Anfragen — der Assistent hat alles im Griff."
        }
        actions={
          tenant && (
            <ButtonLink href={`/demo/${tenant.slug}`} target="_blank" variant="secondary" size="sm">
              Assistent testen <ArrowUpRight size={14} aria-hidden />
            </ButtonLink>
          )
        }
      />

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section
          title="Offene Anfragen"
          hint={leads && leads.length > 0 ? `${leads.length}${leads.length === 8 ? "+" : ""}` : undefined}
          action={
            <Link href="/dashboard/leads" className="text-[0.8125rem] text-ink2 underline-offset-4 hover:text-ink hover:underline">
              Alle Anfragen
            </Link>
          }
        >
          {leads === null ? (
            <LoadingRows />
          ) : leads.length === 0 ? (
            <EmptyState title="Alles erledigt">
              Wenn jemand im Chat einen Rückruf, Termin oder Kontakt wünscht, erscheint die Anfrage hier — und Sie erhalten
              eine E-Mail.
            </EmptyState>
          ) : (
            <ul className="divide-y border-y">
              {leads.map((lead) => (
                <li key={lead.id} className="group relative flex items-start gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="font-medium text-ink after:absolute after:inset-0 after:content-[''] hover:underline underline-offset-4"
                      >
                        {lead.name || lead.email || lead.phone || "Ohne Namen"}
                      </Link>
                      <span className="text-[0.8125rem] text-ink3">{leadTypeLabel(lead.type)}</span>
                      <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
                    </div>
                    {lead.message && <p className="mt-1 line-clamp-1 text-sm text-ink2">{lead.message}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[0.8125rem] tabular-nums text-ink3">{relativeTime(lead.created_at)}</span>
                    {lead.phone && (
                      <a
                        href={telHref(lead.phone)}
                        className="relative z-10 inline-flex items-center gap-1.5 text-[0.8125rem] text-accent hover:underline underline-offset-4"
                      >
                        <Phone size={13} aria-hidden /> Anrufen
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Fragen ohne Antwort" hint="letzte 30 Tage">
          {questions === null ? (
            <LoadingRows rows={3} />
          ) : questions.length === 0 ? (
            <EmptyState title="Keine Wissenslücken">
              Fragen, die der Assistent nicht beantworten konnte, sammeln sich hier. Mit einem Klick ergänzen Sie die Antwort.
            </EmptyState>
          ) : (
            <ul className="divide-y border-y">
              {questions.map((q) => (
                <li key={q.text} className="flex items-start gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">„{q.text}“</p>
                    <p className="mt-0.5 text-xs text-ink3">
                      {q.count > 1 ? `${q.count}× gefragt · ` : ""}
                      {relativeTime(q.last)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/knowledge?frage=${encodeURIComponent(q.text)}`}
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

      <Section
        title="Diesen Monat"
        action={
          <Link href="/dashboard/wirkung" className="text-[0.8125rem] text-ink2 underline-offset-4 hover:text-ink hover:underline">
            Zur Wirkung
          </Link>
        }
      >
        <dl className="grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: "Gespräche", value: stats?.conversations },
            { label: "Anfragen", value: stats?.leads },
            { label: "außerhalb der Öffnungszeiten", value: stats?.outsideHours },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-3 py-4 sm:px-6 sm:first:pl-0">
              <dd className="font-display text-[1.75rem] tabular-nums text-ink">{s.value ?? "–"}</dd>
              <dt className="text-sm text-ink2">{s.label}</dt>
            </div>
          ))}
        </dl>
      </Section>

      {tenant && <EmbedSnippet slug={tenant.slug} />}
    </div>
  );
}

const noSubscribe = () => () => {};

function EmbedSnippet({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  // Server-Render kennt die Domain nicht; useSyncExternalStore vermeidet einen Hydration-Mismatch.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const snippet = `<script src="${origin}/widget.js" data-slug="${slug}" data-origin="${origin}"></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <details className="group rounded-flaeche border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-medium text-ink">Auf Ihrer Website einbinden</span>
          <span className="ml-3 text-ink3">Code-Schnipsel für Ihre Webagentur</span>
        </span>
        <span className="text-ink3 transition-transform duration-150 group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t px-5 py-4">
        <p className="text-sm text-ink2">
          Fügen Sie diese Zeile vor dem schließenden <code className="font-mono text-[0.8125rem]">&lt;/body&gt;</code>-Tag
          jeder Seite ein, auf der der Assistent erscheinen soll.
        </p>
        <pre className="overflow-x-auto rounded-element bg-paper2 px-4 py-3 font-mono text-[0.8125rem] leading-relaxed text-ink">
          {snippet}
        </pre>
        <div>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? "Kopiert" : "Code kopieren"}
          </Button>
        </div>
      </div>
    </details>
  );
}
