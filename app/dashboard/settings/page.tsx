"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const router = useRouter();
  const { tenant, role, loading: authLoading } = useAuth();

  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [revealed, setRevealed] = useState(false);

  const [slackWebhook, setSlackWebhook] = useState("");
  const [hubspotKey, setHubspotKey] = useState("");
  const [pipedriveKey, setPipedriveKey] = useState("");

  useEffect(() => {
    if (!tenant?.id) return;
    async function loadData() {
      const { data: settings } = await supabase
        .from("tenant_settings")
        .select("slack_webhook_url, hubspot_api_key, pipedrive_api_key")
        .eq("tenant_id", tenant!.id)
        .single();

      if (settings) {
        setSlackWebhook(settings.slack_webhook_url ?? "");
        setHubspotKey(settings.hubspot_api_key ?? "");
        setPipedriveKey(settings.pipedrive_api_key ?? "");
      }
      setDataLoading(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    }
    loadData();
  }, [tenant?.id]);

  const loading = authLoading || dataLoading;

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setSaveMsg("");

    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        slack_webhook_url: slackWebhook.trim() || null,
        hubspot_api_key: hubspotKey.trim() || null,
        pipedrive_api_key: pipedriveKey.trim() || null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.ok) {
      setSaveMsg("Einstellungen gespeichert!");
    } else {
      setSaveMsg(`Fehler: ${data.error}`);
    }
    setTimeout(() => setSaveMsg(""), 4000);
  }

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  const inputStyle = {
    width: "100%",
    background: "#fafafa",
    color: "#111",
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "13px",
    border: "1px solid #efefed",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  const sectionStyle = {
    background: "#fff",
    border: "1px solid #efefed",
    borderRadius: "10px",
    padding: "20px 24px",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#bbb", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <div style={{
          background: "#fff",
          borderBottom: "1px solid #efefed",
          padding: "22px 28px",
          ...revealStyle(0),
        }}>
          <p style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "22px",
            fontWeight: 400,
            color: "#0a0a0a",
            letterSpacing: "-0.3px",
          }}>
            Integrationen für{" "}
            <span style={{ fontWeight: 600, fontStyle: "italic", color: "#2d5a1b" }}>
              {tenant?.name ?? ""}
            </span>
          </p>
          <p style={{ fontSize: "12px", color: "#bbb", marginTop: "4px" }}>
            Verbinde deinen Bot mit externen Tools – Leads werden automatisch weitergeleitet.
          </p>
        </div>

        <div style={{ padding: "24px 28px", maxWidth: "640px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Slack */}
          <div style={{ ...sectionStyle, ...revealStyle(0.05) }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "#f0f0f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>
                💬
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Slack</p>
                <p style={{ fontSize: "11px", color: "#bbb" }}>Neue Leads als Slack-Nachricht erhalten</p>
              </div>
              {slackWebhook && (
                <span style={{
                  marginLeft: "auto", fontSize: "10px", padding: "2px 8px",
                  borderRadius: "20px", background: "#edf5e4", color: "#3a6b10",
                  fontWeight: 500,
                }}>
                  Aktiv
                </span>
              )}
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                Webhook URL
              </label>
              <input
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
              />
              <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "5px" }}>
                Einrichten unter: Slack → Apps → Incoming Webhooks
              </p>
            </div>
          </div>

          {/* HubSpot */}
          <div style={{ ...sectionStyle, ...revealStyle(0.1) }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "#fff4ee",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>
                🔶
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>HubSpot</p>
                <p style={{ fontSize: "11px", color: "#bbb" }}>Leads automatisch als Kontakte anlegen</p>
              </div>
              {hubspotKey && (
                <span style={{
                  marginLeft: "auto", fontSize: "10px", padding: "2px 8px",
                  borderRadius: "20px", background: "#edf5e4", color: "#3a6b10",
                  fontWeight: 500,
                }}>
                  Aktiv
                </span>
              )}
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                Private App Token
              </label>
              <input
                value={hubspotKey}
                onChange={(e) => setHubspotKey(e.target.value)}
                placeholder="pat-eu1-..."
                type="password"
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
              />
              <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "5px" }}>
                Einrichten unter: HubSpot → Einstellungen → Integrationen → Private Apps
              </p>
            </div>
          </div>

          {/* Pipedrive */}
          <div style={{ ...sectionStyle, ...revealStyle(0.15) }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "#eef4ff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>
                🔵
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Pipedrive</p>
                <p style={{ fontSize: "11px", color: "#bbb" }}>Leads direkt in Pipedrive-Pipeline eintragen</p>
              </div>
              {pipedriveKey && (
                <span style={{
                  marginLeft: "auto", fontSize: "10px", padding: "2px 8px",
                  borderRadius: "20px", background: "#edf5e4", color: "#3a6b10",
                  fontWeight: 500,
                }}>
                  Aktiv
                </span>
              )}
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                API Token
              </label>
              <input
                value={pipedriveKey}
                onChange={(e) => setPipedriveKey(e.target.value)}
                placeholder="API Token aus Pipedrive Einstellungen"
                type="password"
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
              />
              <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "5px" }}>
                Einrichten unter: Pipedrive → Einstellungen → Persönliche Einstellungen → API
              </p>
            </div>
          </div>

          {/* Speichern */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", ...revealStyle(0.2) }}>
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
              {saving ? "Wird gespeichert..." : "Einstellungen speichern"}
            </button>
            {saveMsg && (
              <span style={{ fontSize: "12px", color: saveMsg.includes("Fehler") ? "#e05" : "#3a6b10" }}>
                {saveMsg}
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}