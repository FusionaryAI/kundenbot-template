"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { resolveVertical } from "@/lib/verticals/registry";
import IntegrationsEditor from "@/components/IntegrationsEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote, LoadingRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const DAYS = [
  { key: "mo", label: "Montag" },
  { key: "di", label: "Dienstag" },
  { key: "mi", label: "Mittwoch" },
  { key: "do", label: "Donnerstag" },
  { key: "fr", label: "Freitag" },
  { key: "sa", label: "Samstag" },
  { key: "so", label: "Sonntag" },
] as const;

type DayHours = { open: string; close: string } | null;
type OpeningHours = Record<string, DayHours>;

const DEFAULT_HOURS: OpeningHours = {
  mo: { open: "08:00", close: "18:00" },
  di: { open: "08:00", close: "18:00" },
  mi: { open: "08:00", close: "18:00" },
  do: { open: "08:00", close: "18:00" },
  fr: { open: "08:00", close: "16:00" },
  sa: null,
  so: null,
};

function SettingsBlock({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t py-10 first:border-t-0 first:pt-2 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className="text-[0.9375rem] font-medium">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink2">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { tenant } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("35");
  const [handlingMinutes, setHandlingMinutes] = useState("4");
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    if (!tenant) return;
    supabase
      .from("tenants")
      .select("hourly_rate_eur, avg_handling_time_minutes, opening_hours")
      .eq("id", tenant.id)
      .single()
      .then(({ data }) => {
        if (data?.hourly_rate_eur != null) setHourlyRate(String(data.hourly_rate_eur));
        if (data?.avg_handling_time_minutes != null) setHandlingMinutes(String(data.avg_handling_time_minutes));
        if (data?.opening_hours && typeof data.opening_hours === "object") {
          setHours({ ...DEFAULT_HOURS, ...(data.opening_hours as OpeningHours) });
        }
        setLoaded(true);
      });
  }, [tenant]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await authedFetch("/api/settings/wirkung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id,
          hourly_rate_eur: Number(hourlyRate),
          avg_handling_time_minutes: Number(handlingMinutes),
          opening_hours: hours,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error();
      setResult("saved");
      setTimeout(() => setResult(null), 2500);
    } catch {
      setResult("error");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(key: string, open: boolean) {
    setHours((prev) => ({ ...prev, [key]: open ? prev[key] ?? { open: "08:00", close: "18:00" } : null }));
  }

  function setTime(key: string, field: "open" | "close", value: string) {
    setHours((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { open: "08:00", close: "18:00" }), [field]: value } }));
  }

  if (!tenant || !loaded) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Einstellungen" />
        <LoadingRows rows={6} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Einstellungen" description="Öffnungszeiten, Berechnungsgrundlage für die Wirkung und Anbindungen an Ihre Systeme." />

      <div>
        <form onSubmit={save}>
          <SettingsBlock
            title="Öffnungszeiten"
            description="Daran erkennt der Assistent, wie viele Anfragen außerhalb Ihrer Geschäftszeiten beantwortet wurden."
          >
            <ul className="divide-y border-y">
              {DAYS.map(({ key, label }) => {
                const day = hours[key];
                return (
                  <li key={key} className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 py-2">
                    <label className="flex w-36 items-center gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={!!day}
                        onChange={(e) => toggleDay(key, e.target.checked)}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {label}
                    </label>
                    {day ? (
                      <div className="flex items-center gap-2 text-sm text-ink2">
                        <Input
                          type="time"
                          aria-label={`${label} öffnet`}
                          value={day.open}
                          onChange={(e) => setTime(key, "open", e.target.value)}
                          className="h-9 w-28 tabular-nums"
                        />
                        <span aria-hidden>–</span>
                        <Input
                          type="time"
                          aria-label={`${label} schließt`}
                          value={day.close}
                          onChange={(e) => setTime(key, "close", e.target.value)}
                          className="h-9 w-28 tabular-nums"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-ink3">geschlossen</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </SettingsBlock>

          <SettingsBlock
            title="Berechnung der Wirkung"
            description="Grundlage für gesparte Zeit und Kosten auf der Seite Wirkung. Schätzwerte genügen."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Stundensatz Ihres Teams" htmlFor="rate" hint="in Euro, inklusive Nebenkosten">
                <Input
                  id="rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1000}
                  step="1"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Minuten je Anfrage" htmlFor="minutes" hint="so lange dauert ein Anruf oder eine E-Mail im Schnitt">
                <Input
                  id="minutes"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={120}
                  step="0.5"
                  value={handlingMinutes}
                  onChange={(e) => setHandlingMinutes(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>
            <div className={cn("mt-6 flex flex-wrap items-center gap-3")}>
              <Button type="submit" disabled={saving}>
                {saving ? "Wird gespeichert …" : "Speichern"}
              </Button>
              {result === "saved" && <span role="status" className="text-[0.8125rem] text-accent">Gespeichert</span>}
            </div>
            {result === "error" && (
              <div className="mt-4">
                <ErrorNote>Speichern fehlgeschlagen. Bitte prüfen Sie die Werte und versuchen Sie es erneut.</ErrorNote>
              </div>
            )}
          </SettingsBlock>
        </form>

        <SettingsBlock
          title="Integrationen"
          description="Neue Anfragen zusätzlich in Ihre Systeme übertragen, etwa als Nachricht in Slack oder als Kontakt im CRM."
        >
          <IntegrationsEditor tenantId={tenant.id} verticalId={resolveVertical(tenant).id} />
        </SettingsBlock>
      </div>
    </div>
  );
}
