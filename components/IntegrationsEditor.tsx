"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { integrationsForVertical } from "@/lib/integrations/registry";
import type { IntegrationAdapter } from "@/lib/integrations/types";

// Wiederverwendbarer Integrations-Editor — genutzt von der Admin-Detailseite
// und vom Kunden-Dashboard. Eine Quelle, ein API-Endpunkt (tenant_integrations),
// kein Split-Brain zwischen den beiden Oberflächen.

export type IntegrationsEditorTheme = {
  inputBg: string;
  border: string;
  focus: string;
  // Optionale Dark-Tokens — fehlen sie, gilt der helle Default (Admin-Oberfläche).
  surface?: string;
  text?: string;
  textMuted?: string;
  inputText?: string;
  activeBg?: string;
  activeColor?: string;
  saveBg?: string;
  saveColor?: string;
  saveHover?: string;
  errorColor?: string;
  okColor?: string;
};

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
  theme,
}: {
  tenantId: string;
  verticalId: string;
  theme: IntegrationsEditorTheme;
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
    showSaveResult(data, "Einstellungen gespeichert!");
  }

  // Farb-Auflösung: Dark-Tokens falls vorhanden, sonst heller Default.
  const c = {
    surface: theme.surface ?? "#fff",
    text: theme.text ?? "#111",
    textMuted: theme.textMuted ?? "#bbb",
    inputText: theme.inputText ?? "#111",
    activeBg: theme.activeBg ?? "#edf5e4",
    activeColor: theme.activeColor ?? "#3a6b10",
    saveBg: theme.saveBg ?? "#111",
    saveColor: theme.saveColor ?? "#fff",
    saveHover: theme.saveHover ?? "#333",
    errorColor: theme.errorColor ?? "#e05",
    okColor: theme.okColor ?? "#3a6b10",
  };

  const inputStyle = {
    width: "100%",
    background: theme.inputBg,
    color: c.inputText,
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "13px",
    border: `1px solid ${theme.border}`,
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  const sectionStyle = {
    background: c.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: "12px",
    padding: "20px 24px",
    backdropFilter: theme.surface ? "blur(22px) saturate(150%)" : undefined,
    WebkitBackdropFilter: theme.surface ? "blur(22px) saturate(150%)" : undefined,
  };

  if (loading) {
    return <p style={{ color: c.textMuted, fontSize: "13px" }}>Integrationen werden geladen...</p>;
  }

  if (loadError) {
    return (
      <p style={{ color: c.errorColor, fontSize: "13px" }}>
        Integrationen konnten nicht geladen werden. Bitte Seite neu laden.
      </p>
    );
  }

  if (adapters.length === 0) {
    return (
      <div style={{ ...sectionStyle, color: c.textMuted, fontSize: "13px" }}>
        Für dieses Profil sind aktuell keine Integrationen verfügbar.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {adapters.map((adapter) => (
        <div key={adapter.id} style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: theme.inputBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
              {adapter.icon}
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: c.text }}>{adapter.label}</p>
              <p style={{ fontSize: "11px", color: c.textMuted }}>{adapter.description}</p>
            </div>
            {isActive(adapter) && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: c.activeBg, color: c.activeColor, fontWeight: 500 }}>
                  Aktiv
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(adapter)}
                  disabled={saving}
                  style={{ background: "none", border: "none", padding: 0, fontSize: "11px", color: c.textMuted, cursor: "pointer", textDecoration: "underline" }}
                >
                  Entfernen
                </button>
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {adapter.fields.map((field) => (
              <div key={field.key}>
                <label style={{ fontSize: "11px", color: c.textMuted, display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  {field.label}
                </label>
                <input
                  value={configs[adapter.id]?.[field.key] ?? ""}
                  onChange={(e) => setField(adapter.id, field.key, e.target.value)}
                  placeholder={
                    field.secret && isSecretSet(adapter.id, field.key)
                      ? "Gespeichert – zum Ändern neu eingeben"
                      : field.placeholder
                  }
                  autoComplete="off"
                  type={field.secret ? "password" : "text"}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = theme.focus}
                  onBlur={(e) => e.currentTarget.style.borderColor = theme.border}
                />
                {(field.help || adapter.setupHint) && (
                  <p style={{ fontSize: "10.5px", color: c.textMuted, marginTop: "5px" }}>
                    {field.help ?? adapter.setupHint}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: c.saveBg, color: c.saveColor, border: "none",
            borderRadius: "9px", padding: "10px 20px", fontSize: "13px",
            fontWeight: 600, cursor: "pointer",
            boxShadow: theme.surface ? "0 10px 30px -8px rgba(63,208,127,0.45)" : "none",
            opacity: saving ? 0.6 : 1, transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = c.saveHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = c.saveBg; }}
        >
          {saving ? "Wird gespeichert..." : "Integrationen speichern"}
        </button>
        {saveMsg && (
          <span style={{ fontSize: "12px", color: saveMsg.includes("Fehler") ? c.errorColor : c.okColor }}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}
