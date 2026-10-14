"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import { listVerticals } from "@/lib/verticals/registry";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/States";

const VERTICAL_OPTIONS = listVerticals().map((v) => ({ id: v.id, label: v.label }));

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Group({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-6 border-t py-8 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-12">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="text-[0.9375rem] font-medium" aria-hidden>{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink2">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </fieldset>
  );
}

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [vertical, setVertical] = useState("");
  const [welcome, setWelcome] = useState("Hallo! Wie kann ich Ihnen helfen?");
  const [fallback, setFallback] = useState("Dazu habe ich leider keine Informationen. Soll ich Ihre Anfrage ans Team weiterleiten?");
  const [leadEmail, setLeadEmail] = useState("");
  const [autoReply, setAutoReply] = useState("Vielen Dank! Wir melden uns zeitnah.");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/create-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          vertical: vertical || null,
          welcome_message: welcome,
          fallback_message: fallback,
          lead_email: leadEmail,
          lead_auto_reply: autoReply,
          client_email: clientEmail,
          client_password: clientPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error);
      router.push(`/admin/${slug}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Anlegen fehlgeschlagen.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 self-start text-[0.8125rem] text-ink2 hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> Alle Kunden
      </Link>
      <PageHeader eyebrow="Fusionary" title="Kunde anlegen" description="Legt Mandant, Assistent und Zugang für den Kunden in einem Schritt an." />

      <form onSubmit={submit} className="flex flex-col">
        <Group title="Unternehmen" description="Name und Adresse des Assistenten. Die Kennung erscheint in der Widget-URL.">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(toSlug(e.target.value));
              }}
              placeholder="z. B. Hausarztpraxis Painten"
            />
          </Field>
          <Field label="Kennung" htmlFor="slug" hint="Kleinbuchstaben, Ziffern und Bindestriche.">
            <Input
              id="slug"
              required
              pattern="[a-z0-9-]+"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(toSlug(e.target.value));
              }}
              className="font-mono"
            />
          </Field>
          <Field label="Branche" htmlFor="vertical" hint="Steuert Schutzregeln, z. B. keine medizinische Beratung bei Praxen.">
            <Select id="vertical" value={vertical} onChange={(e) => setVertical(e.target.value)}>
              <option value="">Automatisch erkennen</option>
              {VERTICAL_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </Group>

        <Group title="Assistent" description="Begrüßung und Antwort, wenn das Wissen nicht reicht. Der KI-Hinweis wird immer automatisch vorangestellt.">
          <Field label="Begrüßung" htmlFor="welcome">
            <Input id="welcome" value={welcome} onChange={(e) => setWelcome(e.target.value)} />
          </Field>
          <Field label="Wenn keine Antwort bekannt ist" htmlFor="fallback">
            <Textarea id="fallback" rows={3} value={fallback} onChange={(e) => setFallback(e.target.value)} />
          </Field>
        </Group>

        <Group title="Anfragen" description="Wohin Rückruf- und Terminwünsche aus dem Chat gehen.">
          <Field label="E-Mail für Anfragen" htmlFor="leadEmail">
            <Input id="leadEmail" type="email" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
          </Field>
          <Field label="Bestätigung an den Besucher" htmlFor="autoReply">
            <Input id="autoReply" value={autoReply} onChange={(e) => setAutoReply(e.target.value)} />
          </Field>
        </Group>

        <Group title="Zugang für den Kunden" description="Damit meldet sich der Kunde im Dashboard an. Passwort sicher übermitteln, nicht per E-Mail.">
          <Field label="E-Mail" htmlFor="clientEmail">
            <Input id="clientEmail" type="email" required autoComplete="off" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </Field>
          <Field label="Startpasswort" htmlFor="clientPassword" hint="Mindestens 8 Zeichen.">
            <Input
              id="clientPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={clientPassword}
              onChange={(e) => setClientPassword(e.target.value)}
            />
          </Field>
        </Group>

        <div className="flex flex-col gap-4 border-t pt-6">
          {error && <ErrorNote>{error}</ErrorNote>}
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird angelegt …" : "Kunde anlegen"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
