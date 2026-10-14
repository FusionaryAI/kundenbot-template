"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { leadStatusLabel, leadStatusTone, leadTypeLabel, relativeTime } from "@/lib/lead-format";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
};

type Filter = "offen" | "erledigt" | "alle";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "offen", label: "Offen" },
  { value: "erledigt", label: "Erledigt" },
  { value: "alle", label: "Alle" },
];

export default function LeadsPage() {
  const { tenant } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("offen");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!tenant) return;
    supabase
      .from("leads")
      .select("id, name, email, phone, message, type, status, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(true);
        setLeads((data as Lead[]) ?? []);
      });
  }, [tenant]);

  const counts = useMemo(() => {
    const all = leads ?? [];
    return {
      offen: all.filter((l) => l.status !== "erledigt").length,
      erledigt: all.filter((l) => l.status === "erledigt").length,
      alle: all.length,
    };
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads ?? [])
      .filter((l) => (filter === "alle" ? true : filter === "erledigt" ? l.status === "erledigt" : l.status !== "erledigt"))
      .filter((l) => !q || [l.name, l.email, l.phone, l.message].some((v) => v?.toLowerCase().includes(q)));
  }, [leads, filter, query]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Anfragen"
        description="Rückruf-, Termin- und Kontaktwünsche, die der Assistent im Chat aufgenommen hat."
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Anfragen filtern" className="inline-flex rounded-full bg-paper2 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              type="button"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-8 rounded-full px-4 text-[0.8125rem] transition-colors duration-150",
                filter === f.value ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink2 hover:text-ink",
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums text-ink3">{leads ? counts[f.value] : ""}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Anfragen durchsuchen</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, Telefon, Anliegen …"
            className="pl-9"
          />
        </label>
      </div>

      {error && <ErrorNote>Die Anfragen konnten nicht geladen werden. Bitte laden Sie die Seite neu.</ErrorNote>}

      {leads === null ? (
        <LoadingRows rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={query ? "Keine Treffer" : filter === "offen" ? "Keine offenen Anfragen" : "Noch keine Anfragen"}
        >
          {query
            ? "Versuchen Sie einen anderen Suchbegriff."
            : "Sobald jemand im Chat einen Rückruf, Termin oder Kontakt wünscht, erscheint die Anfrage hier."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-[0.8125rem] text-ink3">
                <th scope="col" className="py-2.5 pr-4 font-normal">Name</th>
                <th scope="col" className="py-2.5 pr-4 font-normal">Anliegen</th>
                <th scope="col" className="py-2.5 pr-4 font-normal">Art</th>
                <th scope="col" className="py-2.5 pr-4 font-normal">Eingang</th>
                <th scope="col" className="py-2.5 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((lead) => (
                <tr key={lead.id} className="group relative transition-colors duration-150 hover:bg-paper2">
                  <td className="py-3.5 pr-4 align-top">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="font-medium text-ink after:absolute after:inset-0 after:content-['']"
                    >
                      {lead.name || "Ohne Namen"}
                    </Link>
                    <p className="mt-0.5 text-[0.8125rem] text-ink3">{lead.phone || lead.email || "–"}</p>
                  </td>
                  <td className="max-w-[28rem] py-3.5 pr-4 align-top text-ink2">
                    <p className="line-clamp-2">{lead.message || "–"}</p>
                  </td>
                  <td className="whitespace-nowrap py-3.5 pr-4 align-top text-ink2">{leadTypeLabel(lead.type)}</td>
                  <td className="whitespace-nowrap py-3.5 pr-4 align-top tabular-nums text-ink3">{relativeTime(lead.created_at)}</td>
                  <td className="py-3.5 align-top">
                    <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
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
