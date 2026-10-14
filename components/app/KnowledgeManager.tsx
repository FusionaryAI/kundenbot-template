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
import { cn } from "@/lib/cn";
import { KnowledgeTester } from "./KnowledgeTester";

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

async function postJson(url: string, body: unknown) {
  const res = await authedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(typeof data.error === "string" ? data.error : "");
  return data;
}

/** Ein Eintrag der Liste — mit Bearbeiten und Löschen (jeweils inline). */
function KnowledgeRow({
  item,
  editing,
  onEdit,
  onCancel,
  onSaved,
  onDeleted,
}: {
  item: KnowledgeItem;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (title: string | null, content: string) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [content, setContent] = useState(item.content);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setTitle(item.title ?? "");
    setContent(item.content);
    setError("");
    onEdit();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError("");
    try {
      await postJson("/api/knowledge/update", { id: item.id, title: title.trim() || null, content: content.trim() });
      onSaved(title.trim() || null, content.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await postJson("/api/knowledge/delete", { id: item.id });
      onDeleted();
    } catch {
      setError("Löschen fehlgeschlagen. Bitte versuchen Sie es erneut.");
      setBusy(null);
      setConfirming(false);
    }
  }

  if (editing) {
    return (
      <li id={`kb-${item.id}`} className="scroll-mt-24 py-4">
        <form onSubmit={save} className="flex flex-col gap-4 rounded-flaeche bg-paper2 p-5">
          <Field label="Frage oder Thema" htmlFor={`t-${item.id}`}>
            <Input id={`t-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
          </Field>
          <Field label="Antwort" htmlFor={`c-${item.id}`}>
            <Textarea id={`c-${item.id}`} rows={8} required value={content} onChange={(e) => setContent(e.target.value)} autoFocus />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy !== null || !content.trim()}>
              {busy === "save" ? "Wird gespeichert …" : "Korrektur speichern"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy !== null}>
              Abbrechen
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li id={`kb-${item.id}`} className="flex scroll-mt-24 items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        {item.title && <p className="font-medium text-ink">{item.title}</p>}
        <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink2">{item.content}</p>
        <p className="mt-2 flex items-center gap-2 text-xs text-ink3">
          <Badge tone={item.source === "dashboard" || !item.source ? "accent" : "neutral"}>{sourceLabel(item.source)}</Badge>
          {formatDate(item.created_at)}
        </p>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="danger" size="sm" onClick={remove} disabled={busy !== null}>
            {busy === "delete" ? "Wird gelöscht …" : "Endgültig löschen"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Abbrechen
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={startEdit}>
            Bearbeiten
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Löschen
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Wissensbasis eines Mandanten: testen, Eintrag hinzufügen (optional
 * vorbefüllt mit einer unbeantworteten Frage), durchsuchen, korrigieren,
 * löschen. Genutzt im Kunden-Dashboard und im Admin-Bereich.
 */
export function KnowledgeManager({ tenantId, prefillQuestion }: { tenantId: string; prefillQuestion?: string | null }) {
  const [items, setItems] = useState<KnowledgeItem[] | null>(null);
  const [title, setTitle] = useState(prefillQuestion ?? "");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listNote, setListNote] = useState("");
  const [highlightForm, setHighlightForm] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
      await postJson("/api/knowledge/add", { tenant_id: tenantId, title: title.trim() || null, content: content.trim() });
      setTitle("");
      setContent("");
      setMessage({ tone: "ok", text: "Gespeichert. Der Assistent kennt die Antwort ab sofort." });
      await load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error && err.message ? err.message : "Speichern fehlgeschlagen." });
    } finally {
      setAdding(false);
    }
  }

  /** Aus dem Test: Eintrag zum Korrigieren öffnen. Suche leeren, damit er sichtbar ist. */
  function editFromTest(id: string) {
    setQuery("");
    setEditingId(id);
    requestAnimationFrame(() => document.getElementById(`kb-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** Aus dem Test: Formular mit Frage (und ggf. Antwortentwurf) vorbefüllen. */
  function addFromTest(question: string, answer: string) {
    setTitle(question);
    // Chat-Antworten enthalten Markdown-Fettdruck; im Wissen reicht Klartext.
    setContent(answer.replace(/\*\*(.+?)\*\*/g, "$1"));
    setMessage(null);
    setHighlightForm(true);
    setTimeout(() => setHighlightForm(false), 1200);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => !q || i.title?.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="flex flex-col gap-10">
      <KnowledgeTester tenantId={tenantId} onEditItem={editFromTest} onAddAnswer={addFromTest} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <form
          ref={formRef}
          onSubmit={add}
          className={cn(
            "flex scroll-mt-24 flex-col gap-5 self-start rounded-flaeche bg-paper2 p-6 transition-shadow duration-300 lg:sticky lg:top-8",
            highlightForm && "shadow-[0_0_0_2px_var(--color-accent)]",
          )}
        >
          <div>
            <h2 className="text-[0.9375rem] font-medium">Neues Wissen</h2>
            <p className="mt-1 text-sm text-ink2">Schreiben Sie es so, wie Sie es einem neuen Mitarbeiter erklären würden.</p>
          </div>
          <Field label="Frage oder Thema" htmlFor="kb-title" hint="Wird mit durchsucht — am besten so, wie Besucher fragen.">
            <Input id="kb-title" value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Kann ich bei Ihnen parken?" />
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
          {message &&
            (message.tone === "error" ? (
              <ErrorNote>{message.text}</ErrorNote>
            ) : (
              <p role="status" className="text-sm text-accent">{message.text}</p>
            ))}
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

          {listNote && <p role="status" className="mb-3 text-sm text-accent">{listNote}</p>}
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
                <KnowledgeRow
                  key={item.id}
                  item={item}
                  editing={editingId === item.id}
                  onEdit={() => setEditingId(item.id)}
                  onCancel={() => setEditingId(null)}
                  onSaved={(t, c) => {
                    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, title: t, content: c } : i)) ?? null);
                    setEditingId(null);
                    setListNote("Korrektur gespeichert. Testen Sie die Frage oben gleich noch einmal.");
                    setTimeout(() => setListNote(""), 5000);
                  }}
                  onDeleted={() => setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
