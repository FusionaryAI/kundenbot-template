"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { AdminTenantFrame, type AdminTenant } from "@/components/app/AdminTenant";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";
import { leadStatusLabel, leadStatusTone, leadTypeLabel, relativeTime } from "@/lib/lead-format";

type Settings = {
  welcome_message: string;
  fallback_message: string;
  lead_enabled: boolean;
  lead_email: string;
  lead_auto_reply: string;
  public_contact_phone: string;
  public_hours: string;
};

type RecentLead = { id: string; name: string | null; message: string | null; type: string | null; status: string | null; created_at: string };

function Block({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t py-8 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className="text-[0.9375rem] font-medium">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink2">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

function TenantSettings({ tenant }: { tenant: AdminTenant }) {
  const [s, setS] = useState<Settings | null>(null);
  const [leads, setLeads] = useState<RecentLead[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userResult, setUserResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase
        .from("tenant_settings")
        .select("welcome_message, fallback_message, lead_enabled, lead_email, lead_auto_reply, public_contact_phone, public_hours")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
      supabase
        .from("leads")
        .select("id, name, message, type, status, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([settings, recent]) => {
      const d = settings.data;
      setS({
        welcome_message: d?.welcome_message ?? "",
        fallback_message: d?.fallback_message ?? "",
        lead_enabled: d?.lead_enabled !== false,
        lead_email: d?.lead_email ?? "",
        lead_auto_reply: d?.lead_auto_reply ?? "",
        public_contact_phone: d?.public_contact_phone ?? "",
        public_hours: d?.public_hours ?? "",
      });
      setLeads((recent.data as RecentLead[]) ?? []);
    });
  }, [tenant.id]);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setSaving(true);
    setResult(null);
    const { error } = await supabase
      .from("tenant_settings")
      .update({
        ...s,
        lead_email: s.lead_email.trim() || null,
        public_contact_phone: s.public_contact_phone.trim() || null,
        public_hours: s.public_hours.trim() || null,
      })
      .eq("tenant_id", tenant.id);
    setSaving(false);
    setResult(error ? "error" : "saved");
    if (!error) setTimeout(() => setResult(null), 2500);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setUserBusy(true);
    setUserResult(null);
    try {
      const res = await authedFetch("/api/create-client-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, password: userPassword, tenant_id: tenant.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error);
      setUserResult({ ok: true, text: `Zugang für ${data.email ?? userEmail} angelegt.` });
      setUserEmail("");
      setUserPassword("");
    } catch (err) {
      setUserResult({ ok: false, text: err instanceof Error && err.message ? err.message : "Anlegen fehlgeschlagen." });
    } finally {
      setUserBusy(false);
    }
  }

  if (!s) return <LoadingRows rows={6} />;

  return (
    <div className="flex flex-col">
      <form onSubmit={save}>
        <Block title="Assistent" description="Begrüßung und Antwort, wenn das Wissen nicht reicht. Der KI-Hinweis steht immer davor.">
          <Field label="Begrüßung" htmlFor="welcome">
            <Input id="welcome" value={s.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
          </Field>
          <Field label="Wenn keine Antwort bekannt ist" htmlFor="fallback">
            <Textarea id="fallback" rows={3} value={s.fallback_message} onChange={(e) => set("fallback_message", e.target.value)} />
          </Field>
        </Block>

        <Block title="Anfragen" description="Ob der Assistent Rückruf- und Terminwünsche aufnimmt und wohin sie gehen.">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={s.lead_enabled}
              onChange={(e) => set("lead_enabled", e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
            />
            <span>
              <span className="font-medium text-ink">Anfragen aufnehmen und weiterleiten</span>
              <span className="mt-0.5 block text-ink2">
                Aus: Der Assistent verweist nur auf die Kontaktdaten. Bei Praxen vorher die Datenschutzfrage klären.
              </span>
            </span>
          </label>
          <Field label="E-Mail für Anfragen" htmlFor="leadEmail">
            <Input id="leadEmail" type="email" value={s.lead_email} onChange={(e) => set("lead_email", e.target.value)} disabled={!s.lead_enabled} />
          </Field>
          <Field label="Bestätigung an den Besucher" htmlFor="autoReply">
            <Input id="autoReply" value={s.lead_auto_reply} onChange={(e) => set("lead_auto_reply", e.target.value)} disabled={!s.lead_enabled} />
          </Field>
        </Block>

        <Block
          title="Direkter Kontakt"
          description="Nennt der Assistent, wenn er etwas nicht übernehmen darf, z. B. bei medizinischen Fragen."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Telefon" htmlFor="phone">
              <Input id="phone" type="tel" value={s.public_contact_phone} onChange={(e) => set("public_contact_phone", e.target.value)} />
            </Field>
            <Field label="Telefonzeiten" htmlFor="hours" hint="Freitext, erscheint in Klammern hinter der Nummer.">
              <Input id="hours" value={s.public_hours} onChange={(e) => set("public_hours", e.target.value)} placeholder="Mo–Fr 9:00–12:00 Uhr" />
            </Field>
          </div>
          {result === "error" && <ErrorNote>Speichern fehlgeschlagen.</ErrorNote>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Wird gespeichert …" : "Einstellungen speichern"}</Button>
            {result === "saved" && <span role="status" className="text-[0.8125rem] text-accent">Gespeichert</span>}
          </div>
        </Block>
      </form>

      <Block title="Letzte Anfragen" description="Die zehn jüngsten Anfragen dieses Kunden.">
        {leads === null ? (
          <LoadingRows rows={3} />
        ) : leads.length === 0 ? (
          <EmptyState title="Noch keine Anfragen" />
        ) : (
          <ul className="divide-y border-y">
            {leads.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink">
                    <span className="font-medium">{l.name || "Ohne Namen"}</span>
                    <span className="ml-2 text-ink3">{leadTypeLabel(l.type)}</span>
                  </p>
                  {l.message && <p className="mt-0.5 line-clamp-1 text-ink2">{l.message}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={leadStatusTone(l.status)}>{leadStatusLabel(l.status)}</Badge>
                  <span className="text-xs tabular-nums text-ink3">{relativeTime(l.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Weiterer Zugang" description="Zusätzliche Person des Kunden, die das Dashboard nutzen soll.">
        <form onSubmit={createUser} className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-Mail" htmlFor="userEmail">
              <Input id="userEmail" type="email" required autoComplete="off" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
            </Field>
            <Field label="Startpasswort" htmlFor="userPassword" hint="Mindestens 8 Zeichen.">
              <Input
                id="userPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
              />
            </Field>
          </div>
          {userResult &&
            (userResult.ok ? <p role="status" className="text-sm text-accent">{userResult.text}</p> : <ErrorNote>{userResult.text}</ErrorNote>)}
          <div>
            <Button type="submit" variant="secondary" disabled={userBusy}>
              {userBusy ? "Wird angelegt …" : "Zugang anlegen"}
            </Button>
          </div>
        </form>
      </Block>
    </div>
  );
}

export default function AdminTenantPage() {
  const { slug } = useParams<{ slug: string }>();
  return <AdminTenantFrame slug={slug}>{(tenant) => <TenantSettings tenant={tenant} />}</AdminTenantFrame>;
}
