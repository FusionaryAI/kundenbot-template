"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mo", label: "Montag" },
  { key: "di", label: "Dienstag" },
  { key: "mi", label: "Mittwoch" },
  { key: "do", label: "Donnerstag" },
  { key: "fr", label: "Freitag" },
  { key: "sa", label: "Samstag" },
  { key: "so", label: "Sonntag" },
];

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

  // Wirkung config
  const [hourlyRate, setHourlyRate] = useState<string>("35");
  const [handlingMinutes, setHandlingMinutes] = useState<string>("4");
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [wirkungSaving, setWirkungSaving] = useState(false);
  const [wirkungMsg, setWirkungMsg] = useState("");

  useEffect(() => {
    if (!tenant?.id) return;
    async function loadData() {
      const tenantId = tenant!.id;
      const [settingsRes, tenantRes] = await Promise.all([
        supabase
          .from("tenant_settings")
          .select("slack_webhook_url, hubspot_api_key, pipedrive_api_key")
          .eq("tenant_id", tenantId)
          .single(),
        supabase
          .from("tenants")
          .select("hourly_rate_eur, avg_handling_time_minutes, opening_hours")
          .eq("id", tenantId)
          .single(),
      ]);

      const settings = settingsRes.data;
      if (settings) {
        setSlackWebhook(settings.slack_webhook_url ?? "");
        setHubspotKey(settings.hubspot_api_key ?? "");
        setPipedriveKey(settings.pipedrive_api_key ?? "");
      }
      const t = tenantRes.data;
      if (t) {
        if (t.hourly_rate_eur != null) setHourlyRate(String(t.hourly_rate_eur));
        if (t.avg_handling_time_minutes != null)
          setHandlingMinutes(String(t.avg_handling_time_minutes));
        if (t.opening_hours && typeof t.opening_hours === "object") {
          setOpeningHours({ ...DEFAULT_HOURS, ...(t.opening_hours as OpeningHours) });
        }
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

  async function handleSaveWirkung() {
    if (!tenant) return;
    setWirkungSaving(true);
    setWirkungMsg("");

    const res = await fetch("/api/settings/wirkung", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        hourly_rate_eur: Number(hourlyRate),
        avg_handling_time_minutes: Number(handlingMinutes),
        opening_hours: openingHours,
      }),
    });

    const data = await res.json();
    setWirkungSaving(false);

    if (data.ok) {
      setWirkungMsg("Gespeichert!");
    } else {
      setWirkungMsg(`Fehler: ${data.error}`);
    }
    setTimeout(() => setWirkungMsg(""), 4000);
  }

  function setDayOpen(key: string, open: boolean) {
    setOpeningHours((prev) => ({
      ...prev,
      [key]: open ? prev[key] ?? { open: "08:00", close: "18:00" } : null,
    }));
  }
  function setDayTime(key: string, field: "open" | "close", value: string) {
    setOpeningHours((prev) => {
      const current = prev[key] ?? { open: "08:00", close: "18:00" };
      return { ...prev, [key]: { ...current, [field]: value } };
    });
  }

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  const inputStyle = {
    width: "100%",
    background: "#fafaf8",
    color: "#111",
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "13px",
    border: "1px solid #e8e6e0",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  const sectionStyle = {
    background: "#fff",
    border: "1px solid #e8e6e0",
    borderRadius: "10px",
    padding: "20px 24px",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf8", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#bbb", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf8" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e8e6e0",
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
                background: "#e8e6e0",
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
                onFocus={(e) => e.currentTarget.style.borderColor = "#c4d9cc"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e8e6e0"}
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
                onFocus={(e) => e.currentTarget.style.borderColor = "#c4d9cc"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e8e6e0"}
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
                background: "#f1efea",
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
                onFocus={(e) => e.currentTarget.style.borderColor = "#c4d9cc"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e8e6e0"}
              />
              <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "5px" }}>
                Einrichten unter: Pipedrive → Einstellungen → Persönliche Einstellungen → API
              </p>
            </div>
          </div>

          {/* Speichern (Integrationen) */}
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
              {saving ? "Wird gespeichert..." : "Integrationen speichern"}
            </button>
            {saveMsg && (
              <span style={{ fontSize: "12px", color: saveMsg.includes("Fehler") ? "#e05" : "#3a6b10" }}>
                {saveMsg}
              </span>
            )}
          </div>

          {/* Section heading: Wirkung */}
          <div style={{ marginTop: "32px", marginBottom: "4px", ...revealStyle(0.22) }}>
            <p style={{
              fontFamily: "var(--font-instrument-serif), var(--font-playfair), Georgia, serif",
              fontSize: "22px",
              color: "#0f0f0e",
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}>
              Wirkung berechnen
            </p>
            <p style={{ fontSize: "12.5px", color: "#888780", marginTop: "4px" }}>
              Diese Werte fließen in das Wirkung-Dashboard ein – Zeit- und Kostenersparnis basieren darauf.
            </p>
          </div>

          {/* Berechnung */}
          <div style={{ ...sectionStyle, ...revealStyle(0.25) }}>
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f0f0e" }}>Berechnung der Wirkung</p>
              <p style={{ fontSize: "11.5px", color: "#888780", marginTop: "2px" }}>
                Wie viel ist eine Mitarbeiterstunde wert – und wie lange dauert eine typische Anfrage?
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  Stundensatz Ihrer Mitarbeiter (€)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  style={inputStyle}
                />
                <p style={{ fontSize: "10.5px", color: "#888780", marginTop: "5px" }}>
                  Wird verwendet, um die Kostenersparnis zu berechnen.
                </p>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  Bearbeitungszeit pro Anfrage (Minuten)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={120}
                  step={0.5}
                  value={handlingMinutes}
                  onChange={(e) => setHandlingMinutes(e.target.value)}
                  style={inputStyle}
                />
                <p style={{ fontSize: "10.5px", color: "#888780", marginTop: "5px" }}>
                  Wie lange würde ein Mitarbeiter durchschnittlich für eine Anfrage am Telefon brauchen?
                </p>
              </div>
            </div>
          </div>

          {/* Öffnungszeiten */}
          <div style={{ ...sectionStyle, ...revealStyle(0.3) }}>
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f0f0e" }}>Öffnungszeiten</p>
              <p style={{ fontSize: "11.5px", color: "#888780", marginTop: "2px" }}>
                Anfragen außerhalb dieser Zeiten zählen als „nach Feierabend abgefangen".
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {DAYS.map((d) => {
                const hours = openingHours[d.key];
                const isOpen = !!hours;
                return (
                  <div
                    key={d.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 90px 1fr 1fr",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <p style={{ fontSize: "13px", color: "#0f0f0e", fontWeight: 500 }}>{d.label}</p>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: "#4a4a47" }}>
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => setDayOpen(d.key, e.target.checked)}
                        style={{ accentColor: "#1a5c3a" }}
                      />
                      {isOpen ? "Geöffnet" : "Geschlossen"}
                    </label>
                    <input
                      type="time"
                      value={hours?.open ?? "08:00"}
                      disabled={!isOpen}
                      onChange={(e) => setDayTime(d.key, "open", e.target.value)}
                      style={{ ...inputStyle, opacity: isOpen ? 1 : 0.4 }}
                    />
                    <input
                      type="time"
                      value={hours?.close ?? "18:00"}
                      disabled={!isOpen}
                      onChange={(e) => setDayTime(d.key, "close", e.target.value)}
                      style={{ ...inputStyle, opacity: isOpen ? 1 : 0.4 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Speichern (Wirkung) */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", ...revealStyle(0.35) }}>
            <button
              onClick={handleSaveWirkung}
              disabled={wirkungSaving}
              style={{
                background: "#1a5c3a", color: "#fff", border: "none",
                borderRadius: "8px", padding: "10px 20px", fontSize: "13px",
                fontWeight: 500, cursor: "pointer",
                opacity: wirkungSaving ? 0.6 : 1, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!wirkungSaving) e.currentTarget.style.background = "#144a2e"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#1a5c3a"; }}
            >
              {wirkungSaving ? "Wird gespeichert..." : "Wirkungs-Einstellungen speichern"}
            </button>
            {wirkungMsg && (
              <span style={{ fontSize: "12px", color: wirkungMsg.includes("Fehler") ? "#e05" : "#1a5c3a" }}>
                {wirkungMsg}
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}