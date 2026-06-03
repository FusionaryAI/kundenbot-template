"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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
};

type ConfigState = Record<string, Record<string, string>>;

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: rows } = await supabase
        .from("tenant_integrations")
        .select("integration, config")
        .eq("tenant_id", tenantId);
      if (cancelled) return;

      const initial: ConfigState = {};
      for (const adapter of adapters) {
        const row = rows?.find((r) => r.integration === adapter.id);
        const cfg = (row?.config ?? {}) as Record<string, unknown>;
        initial[adapter.id] = {};
        for (const field of adapter.fields) {
          const v = cfg[field.key];
          initial[adapter.id][field.key] = typeof v === "string" ? v : "";
        }
      }
      setConfigs(initial);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [tenantId, adapters]);

  function setField(integration: string, key: string, value: string) {
    setConfigs((prev) => ({
      ...prev,
      [integration]: { ...prev[integration], [key]: value },
    }));
  }

  // Aktiv = alle Felder der Integration ausgefüllt.
  function isActive(adapter: IntegrationAdapter) {
    const cfg = configs[adapter.id] ?? {};
    return adapter.fields.every((f) => (cfg[f.key] ?? "").trim().length > 0);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");

    const payload = adapters.map((a) => ({ integration: a.id, config: configs[a.id] ?? {} }));
    const res = await authedFetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, integrations: payload }),
    });
    const data = await res.json();
    setSaving(false);

    if (data.ok) {
      setSaveMsg("Einstellungen gespeichert!");
    } else {
      const failed = data?.results
        ? Object.entries(data.results).find(([, r]) => !(r as { ok: boolean }).ok)
        : null;
      setSaveMsg(
        failed
          ? `Fehler bei ${failed[0]}: ${(failed[1] as { error?: string }).error ?? "unbekannt"}`
          : `Fehler: ${data.error ?? "unbekannt"}`,
      );
    }
    setTimeout(() => setSaveMsg(""), 4000);
  }

  const inputStyle = {
    width: "100%",
    background: theme.inputBg,
    color: "#111",
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
    background: "#fff",
    border: `1px solid ${theme.border}`,
    borderRadius: "10px",
    padding: "20px 24px",
  };

  if (loading) {
    return <p style={{ color: "#bbb", fontSize: "13px" }}>Integrationen werden geladen...</p>;
  }

  if (adapters.length === 0) {
    return (
      <div style={{ ...sectionStyle, color: "#bbb", fontSize: "13px" }}>
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
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>{adapter.label}</p>
              <p style={{ fontSize: "11px", color: "#bbb" }}>{adapter.description}</p>
            </div>
            {isActive(adapter) && (
              <span style={{ marginLeft: "auto", fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "#edf5e4", color: "#3a6b10", fontWeight: 500 }}>
                Aktiv
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {adapter.fields.map((field) => (
              <div key={field.key}>
                <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  {field.label}
                </label>
                <input
                  value={configs[adapter.id]?.[field.key] ?? ""}
                  onChange={(e) => setField(adapter.id, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  type={field.secret ? "password" : "text"}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = theme.focus}
                  onBlur={(e) => e.currentTarget.style.borderColor = theme.border}
                />
                {(field.help || adapter.setupHint) && (
                  <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "5px" }}>
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
            background: "#111", color: "#fff", border: "none",
            borderRadius: "8px", padding: "10px 20px", fontSize: "13px",
            fontWeight: 500, cursor: "pointer",
            opacity: saving ? 0.6 : 1, transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "#333"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#111"; }}
        >
          {saving ? "Wird gespeichert..." : "Integrationen speichern"}
        </button>
        {saveMsg && (
          <span style={{ fontSize: "12px", color: saveMsg.includes("Fehler") ? "#e05" : "#3a6b10" }}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}
