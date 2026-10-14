"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { integrationsForVertical } from "@/lib/integrations/registry";
import type { IntegrationAdapter } from "@/lib/integrations/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/States";

// Wiederverwendbarer Integrations-Editor — genutzt von der Admin-Detailseite
// und vom Kunden-Dashboard. Eine Quelle, ein API-Endpunkt (tenant_integrations),
// kein Split-Brain zwischen den beiden Oberflächen.

type ConfigState = Record<string, Record<string, string>>;
type StoredIntegrations = Record<string, { values: Record<string, string>; secretsSet: string[] }>;

// Gespeicherte Konfiguration vom Server — geheime Felder nur als "ist gesetzt".
async function fetchStoredIntegrations(tenantId: string): Promise<StoredIntegrations | null> {
  const res = await authedFetch(
    `/api/settings/integrations?tenant_id=${encodeURIComponent(tenantId)}`,
  ).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => null) : null;
  return data?.ok ? (data.integrations as StoredIntegrations) : null;
}

export default function IntegrationsEditor({
  tenantId,
  verticalId,
}: {
  tenantId: string;
  verticalId: string;
}) {
  const adapters = useMemo<IntegrationAdapter[]>(
    () => integrationsForVertical(verticalId),
    [verticalId],
  );

  const [configs, setConfigs] = useState<ConfigState>({});
  // Gespeicherte Geheimfelder: Der Server meldet nur "ist gesetzt", nie den Wert.
  const [secretsSet, setSecretsSet] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const applyStored = useCallback((stored: StoredIntegrations | null) => {
    if (!stored) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const initial: ConfigState = {};
    const secrets: Record<string, string[]> = {};
    for (const adapter of adapters) {
      initial[adapter.id] = {};
      for (const field of adapter.fields) {
        initial[adapter.id][field.key] = stored[adapter.id]?.values[field.key] ?? "";
      }
      secrets[adapter.id] = stored[adapter.id]?.secretsSet ?? [];
    }
    setConfigs(initial);
    setSecretsSet(secrets);
    setLoadError(false);
    setLoading(false);
  }, [adapters]);

  useEffect(() => {
    let cancelled = false;
    fetchStoredIntegrations(tenantId).then((stored) => {
      if (!cancelled) applyStored(stored);
    });
    return () => { cancelled = true; };
  }, [tenantId, applyStored]);

  async function load() {
    applyStored(await fetchStoredIntegrations(tenantId));
  }

  function setField(integration: string, key: string, value: string) {
    setConfigs((prev) => ({
      ...prev,
      [integration]: { ...prev[integration], [key]: value },
    }));
  }

  function isSecretSet(adapterId: string, key: string) {
    return (secretsSet[adapterId] ?? []).includes(key);
  }

  // Aktiv = alle Felder ausgefüllt bzw. (bei Geheimfeldern) bereits gespeichert.
  function isActive(adapter: IntegrationAdapter) {
    const cfg = configs[adapter.id] ?? {};
    return adapter.fields.every(
      (f) => (cfg[f.key] ?? "").trim().length > 0 || isSecretSet(adapter.id, f.key),
    );
  }

  async function postIntegrations(integrations: unknown[]) {
    const res = await authedFetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, integrations }),
    });
    return res.json().catch(() => ({ ok: false }));
  }

  function showSaveResult(data: { ok?: boolean; error?: string; results?: Record<string, { ok: boolean; error?: string }> }, okText: string) {
    if (data.ok) {
      setSaveMsg(okText);
    } else {
      const failed = data?.results
        ? Object.entries(data.results).find(([, r]) => !r.ok)
        : null;
      setSaveMsg(
        failed
          ? `Fehler bei ${failed[0]}: ${failed[1].error ?? "unbekannt"}`
          : `Fehler: ${data.error ?? "unbekannt"}`,
      );
    }
    setTimeout(() => setSaveMsg(""), 4000);
  }

  async function handleRemove(adapter: IntegrationAdapter) {
    setSaving(true);
    setSaveMsg("");
    const data = await postIntegrations([{ integration: adapter.id, remove: true }]);
    setSaving(false);
    if (data.ok) await load();
    showSaveResult(data, `${adapter.label} entfernt.`);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    const data = await postIntegrations(
      adapters.map((a) => ({ integration: a.id, config: configs[a.id] ?? {} })),
    );
    setSaving(false);
    // Neu laden: Eingegebene Tokens verschwinden aus dem Formular und
    // erscheinen als "gespeichert".
    if (data.ok) await load();
    showSaveResult(data, "Gespeichert.");
  }

  if (loading) return <LoadingRows rows={3} />;

  if (loadError) {
    return <ErrorNote>Integrationen konnten nicht geladen werden. Bitte laden Sie die Seite neu.</ErrorNote>;
  }

  if (adapters.length === 0) {
    return <EmptyState title="Keine Integrationen verfügbar">Für diese Branche sind derzeit keine Anbindungen vorgesehen.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y border-y">
        {adapters.map((adapter) => (
          <li key={adapter.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-10">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="font-medium text-ink">{adapter.label}</p>
                {isActive(adapter) && <Badge tone="accent">Aktiv</Badge>}
              </div>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink2">{adapter.description}</p>
              {isActive(adapter) && (
                <button
                  type="button"
                  onClick={() => handleRemove(adapter)}
                  disabled={saving}
                  className="mt-2 text-[0.8125rem] text-ink3 underline underline-offset-4 hover:text-danger disabled:opacity-50"
                >
                  Verbindung entfernen
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {adapter.fields.map((field) => {
                const id = `int-${adapter.id}-${field.key}`;
                return (
                  <Field key={field.key} label={field.label} htmlFor={id} hint={field.help ?? adapter.setupHint}>
                    <Input
                      id={id}
                      value={configs[adapter.id]?.[field.key] ?? ""}
                      onChange={(e) => setField(adapter.id, field.key, e.target.value)}
                      placeholder={
                        field.secret && isSecretSet(adapter.id, field.key)
                          ? "Gespeichert – zum Ändern neu eingeben"
                          : field.placeholder
                      }
                      autoComplete="off"
                      type={field.secret ? "password" : "text"}
                    />
                  </Field>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Wird gespeichert …" : "Integrationen speichern"}
        </Button>
        {saveMsg &&
          (saveMsg.startsWith("Fehler") ? (
            <span role="alert" className="text-[0.8125rem] text-danger">{saveMsg}</span>
          ) : (
            <span role="status" className="text-[0.8125rem] text-accent">{saveMsg}</span>
          ))}
      </div>
    </div>
  );
}
