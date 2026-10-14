"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";
import { resolveVertical } from "@/lib/verticals/registry";
import { formatDate } from "@/lib/lead-format";

type Row = {
  id: string;
  name: string;
  slug: string;
  vertical: string | null;
  created_at: string;
  conversations: number;
  openLeads: number;
  gaps: number;
  knowledge: number;
  leadEnabled: boolean;
  leadEmail: string | null;
};

function countBy<T extends { tenant_id: string }>(rows: T[] | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
  return m;
}

export default function AdminOverviewPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    // Je Tabelle eine Abfrage für alle Mandanten statt einer pro Mandant.
    Promise.all([
      supabase.from("tenants").select("id, name, slug, vertical, created_at").order("created_at", { ascending: false }),
      supabase.from("conversation_analytics").select("tenant_id").gte("started_at", since30),
      supabase.from("leads").select("tenant_id").neq("status", "erledigt"),
      supabase.from("unanswered_questions").select("tenant_id").gte("created_at", since30),
      supabase.from("knowledge_items").select("tenant_id"),
      supabase.from("tenant_settings").select("tenant_id, lead_enabled, lead_email"),
    ]).then(([tenants, convs, leads, gaps, kb, settings]) => {
      if (tenants.error) {
        setError(true);
        setRows([]);
        return;
      }
      const c = countBy(convs.data), l = countBy(leads.data), g = countBy(gaps.data), k = countBy(kb.data);
      const s = new Map((settings.data ?? []).map((x) => [x.tenant_id, x]));
      setRows(
        (tenants.data ?? []).map((t) => ({
          ...t,
          conversations: c.get(t.id) ?? 0,
          openLeads: l.get(t.id) ?? 0,
          gaps: g.get(t.id) ?? 0,
          knowledge: k.get(t.id) ?? 0,
          leadEnabled: s.get(t.id)?.lead_enabled !== false,
          leadEmail: s.get(t.id)?.lead_email ?? null,
        })),
      );
    });
  }, []);

  const totals = rows && {
    conversations: rows.reduce((a, r) => a + r.conversations, 0),
    openLeads: rows.reduce((a, r) => a + r.openLeads, 0),
    gaps: rows.reduce((a, r) => a + r.gaps, 0),
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Fusionary"
        title="Alle Kunden"
        description={
          totals
            ? `${rows!.length} Assistenten · ${totals.conversations} Gespräche in 30 Tagen · ${totals.openLeads} offene Anfragen · ${totals.gaps} Wissenslücken`
            : "Zustand aller Kunden-Assistenten auf einen Blick."
        }
        actions={
          <ButtonLink href="/admin/new" size="sm">
            <Plus size={14} aria-hidden /> Kunde anlegen
          </ButtonLink>
        }
      />

      {error && <ErrorNote>Die Kundenliste konnte nicht geladen werden.</ErrorNote>}

      {rows === null ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="Noch keine Kunden" action={<ButtonLink href="/admin/new" size="sm">Ersten Kunden anlegen</ButtonLink>}>
          Legen Sie einen Kunden an, um seinen Assistenten einzurichten.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-[0.8125rem] text-ink3">
                <th scope="col" className="py-2.5 pr-4 font-normal">Kunde</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-normal">Gespräche 30 T.</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-normal">Offene Anfragen</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-normal">Wissenslücken</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-normal">Wissen</th>
                <th scope="col" className="py-2.5 font-normal">Weiterleitung</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="relative transition-colors duration-150 hover:bg-paper2">
                  <td className="py-3.5 pr-4">
                    <Link href={`/admin/${r.slug}`} className="font-medium text-ink after:absolute after:inset-0 after:content-['']">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 text-[0.8125rem] text-ink3">
                      {resolveVertical(r).label} · seit {formatDate(r.created_at)}
                    </p>
                  </td>
                  <td className="py-3.5 pr-4 text-right tabular-nums text-ink">{r.conversations}</td>
                  <td className="py-3.5 pr-4 text-right tabular-nums">
                    {r.openLeads > 0 ? <Badge tone="accent">{r.openLeads}</Badge> : <span className="text-ink3">0</span>}
                  </td>
                  <td className="py-3.5 pr-4 text-right tabular-nums">
                    {r.gaps > 0 ? <Badge tone="warn">{r.gaps}</Badge> : <span className="text-ink3">0</span>}
                  </td>
                  <td className="py-3.5 pr-4 text-right tabular-nums text-ink2">{r.knowledge}</td>
                  <td className="py-3.5 text-[0.8125rem]">
                    {r.leadEnabled ? (
                      <span className="text-ink2">{r.leadEmail ?? <span className="text-danger">keine E-Mail</span>}</span>
                    ) : (
                      <span className="text-ink3">aus</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
