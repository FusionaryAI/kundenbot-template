"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import {
  LEAD_STATUSES,
  formatDateTime,
  leadStatusLabel,
  leadStatusTone,
  leadTypeLabel,
  telHref,
  type LeadStatus,
} from "@/lib/lead-format";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
  preferred_contact: string | null;
  appointment_topic: string | null;
  appointment_window: string | null;
  metadata: { notes?: string } | null;
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [status, setStatus] = useState<LeadStatus>("neu");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    supabase
      .from("leads")
      .select("id, name, email, phone, message, type, status, created_at, preferred_contact, appointment_topic, appointment_window, metadata")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setLead((data as Lead) ?? null);
        if (data) {
          setStatus((data.status as LeadStatus) ?? "neu");
          setNotes(data.metadata?.notes ?? "");
        }
      });
  }, [id]);

  async function save(nextStatus = status) {
    if (!lead) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await authedFetch("/api/leads/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, status: nextStatus, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error();
      setStatus(nextStatus);
      setLead({ ...lead, status: nextStatus, metadata: { ...(lead.metadata ?? {}), notes } });
      setFeedback("saved");
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback("error");
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink2 hover:text-ink">
      <ArrowLeft size={14} aria-hidden /> Alle Anfragen
    </Link>
  );

  if (lead === undefined) return <div className="flex flex-col gap-6">{back}<LoadingRows rows={5} /></div>;
  if (lead === null)
    return (
      <div className="flex flex-col gap-6">
        {back}
        <EmptyState title="Anfrage nicht gefunden">Sie wurde gelöscht oder gehört zu einem anderen Konto.</EmptyState>
      </div>
    );

  const displayName = lead.name || lead.email || lead.phone || "Ohne Namen";
  const dirty = status !== (lead.status ?? "neu") || notes !== (lead.metadata?.notes ?? "");

  return (
    <div className="flex flex-col gap-8">
      {back}
      <PageHeader
        eyebrow={`${leadTypeLabel(lead.type)} · ${formatDateTime(lead.created_at)}`}
        title={displayName}
        actions={
          <>
            {lead.phone && (
              <a href={telHref(lead.phone)} className={buttonClass({ variant: "primary", size: "sm" })}>
                <Phone size={14} aria-hidden /> Anrufen
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}?subject=${encodeURIComponent("Ihre Anfrage")}`}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                <Mail size={14} aria-hidden /> E-Mail schreiben
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-[0.9375rem] font-medium">Anliegen</h2>
            <p className="whitespace-pre-wrap rounded-flaeche bg-paper2 px-5 py-4 text-sm leading-relaxed text-ink">
              {lead.message || "Kein Anliegen angegeben."}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[0.9375rem] font-medium">Kontakt</h2>
            <dl className="divide-y border-y text-sm">
              {[
                ["Telefon", lead.phone ? <a key="p" href={telHref(lead.phone)} className="text-accent hover:underline underline-offset-4">{lead.phone}</a> : null],
                ["E-Mail", lead.email ? <a key="e" href={`mailto:${lead.email}`} className="text-accent hover:underline underline-offset-4">{lead.email}</a> : null],
                ["Bevorzugt", lead.preferred_contact === "phone" ? "Telefon" : lead.preferred_contact === "email" ? "E-Mail" : null],
                ["Thema", lead.appointment_topic],
                ["Wunschzeit", lead.appointment_window],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k as string} className="grid grid-cols-[8rem_1fr] gap-4 py-3">
                    <dt className="text-ink3">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[0.9375rem] font-medium">Bearbeitung</h2>
              <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
            </div>
            <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 rounded-full bg-paper2 p-1">
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={status === s.value}
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    "h-8 rounded-full px-2 text-[0.8125rem] transition-colors duration-150",
                    status === s.value ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink2 hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <Field label="Interne Notiz" htmlFor="notes" hint="Nur für Ihr Team sichtbar.">
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. Rückruf vereinbart für Donnerstag"
              rows={5}
            />
          </Field>

          {feedback === "error" && <ErrorNote>Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.</ErrorNote>}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => save()} disabled={saving || !dirty}>
              {saving ? "Wird gespeichert …" : "Speichern"}
            </Button>
            {lead.status !== "erledigt" && (
              <Button variant="secondary" onClick={() => save("erledigt")} disabled={saving}>
                Als erledigt markieren
              </Button>
            )}
            {feedback === "saved" && <span className="text-[0.8125rem] text-accent" role="status">Gespeichert</span>}
          </div>
        </aside>
      </div>
    </div>
  );
}
