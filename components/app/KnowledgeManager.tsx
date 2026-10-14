"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";
import { formatDate } from "@/lib/lead-format";

type KnowledgeItem = {
  id: string;
  title: string | null;
  content: string;
  source: string | null;
  created_at: string;
};

function sourceLabel(source: string | null) {
  if (!source || source === "dashboard") return "Eigener Eintrag";
  if (source.startsWith("http")) {
    try {
      return new URL(source).pathname.replace(/\/$/, "") || "Startseite";
    } catch {
      return "Website";
    }
  }
  return source;
}

/**
 * Wissensbasis eines Mandanten: Eintrag hinzufügen (optional vorbefüllt mit
 * einer unbeantworteten Frage), durchsuchen, löschen. Genutzt im Kunden-
 * Dashboard und im Admin-Bereich.
 */
export function KnowledgeManager({ tenantId, prefillQuestion }: { tenantId: string; prefillQuestion?: string | null }) {
  const [items, setItems] = useState<KnowledgeItem[] | null>(null);
  const [title, setTitle] = useState(prefillQuestion ?? "");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("knowledge_items")
      .select("id, title, content, source, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setItems((data as KnowledgeItem[]) ?? []);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (prefillQuestion) contentRef.current?.focus();
  }, [prefillQuestion]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await authedFetch("/api/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, title: title.trim() || null, content: content.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error();
      setTitle("");
      setContent("");
      setMessage({ tone: "ok", text: "Gespeichert. Der Assistent kennt die Antwort ab sofort." });
      await load();
    } catch {
      setMessage({ tone: "error", text: "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut." });
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      const res = await authedFetch("/api/knowledge/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error();
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
    } catch {
      setMessage({ tone: "error", text: "Löschen fehlgeschlagen. Bitte versuchen Sie es erneut." });
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => !q || i.title?.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <form onSubmit={add} className="flex flex-col gap-5 self-start rounded-flaeche bg-paper2 p-6 lg:sticky lg:top-8">
        <div>
          <h2 className="text-[0.9375rem] font-medium">Neues Wissen</h2>
          <p className="mt-1 text-sm text-ink2">
            Schreiben Sie es so, wie Sie es einem neuen Mitarbeiter erklären würden.
          </p>
        </div>
        <Field label="Frage oder Thema" htmlFor="kb-title" hint="Optional, hilft beim Wiederfinden.">
          <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Parken an der Praxis" />
        </Field>
        <Field label="Antwort" htmlFor="kb-content">
          <Textarea
            id="kb-content"
            ref={contentRef}
            required
            rows={7}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="z. B. Vor der Praxis gibt es drei kostenlose Parkplätze, weitere direkt gegenüber."
          />
        </Field>
        {message && (message.tone === "error" ? <ErrorNote>{message.text}</ErrorNote> : <p role="status" className="text-sm text-accent">{message.text}</p>)}
        <div>
          <Button type="submit" disabled={adding || !content.trim()}>
            {adding ? "Wird gespeichert …" : "Wissen speichern"}
          </Button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.9375rem] font-medium">
            Gespeichertes Wissen <span className="ml-1 font-normal tabular-nums text-ink3">{items?.length ?? ""}</span>
          </h2>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Wissen durchsuchen</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3" aria-hidden />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Durchsuchen …" className="pl-9" />
          </label>
        </div>

        {items === null ? (
          <LoadingRows rows={5} />
        ) : visible.length === 0 ? (
          <EmptyState title={query ? "Keine Treffer" : "Noch kein Wissen hinterlegt"}>
            {query
              ? "Versuchen Sie einen anderen Suchbegriff."
              : "Beginnen Sie mit dem, was am häufigsten gefragt wird: Öffnungszeiten, Anfahrt, Leistungen, Preise."}
          </EmptyState>
        ) : (
          <ul className="divide-y border-y">
            {visible.map((item) => (
              <li key={item.id} className="flex items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  {item.title && <p className="font-medium text-ink">{item.title}</p>}
                  <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink2">{item.content}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-ink3">
                    <Badge tone={item.source === "dashboard" || !item.source ? "accent" : "neutral"}>{sourceLabel(item.source)}</Badge>
                    {formatDate(item.created_at)}
                  </p>
                </div>
                {confirmId === item.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="danger" size="sm" onClick={() => remove(item.id)} disabled={deletingId === item.id}>
                      {deletingId === item.id ? "Wird gelöscht …" : "Endgültig löschen"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setConfirmId(item.id)}>
                    Löschen
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
