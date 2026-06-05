"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import Sidebar from "@/components/Sidebar";
import IntegrationsEditor from "@/components/IntegrationsEditor";
import { useAuth } from "@/hooks/useAuth";
import { resolveVertical } from "@/lib/verticals/registry";
import { t, glass, ctaPrimary, inputDark, editorTheme, topbar, DashboardShell } from "@/lib/dashboardTheme";

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
  const { tenant, role, loading: authLoading } = useAuth();

  const [dataLoading, setDataLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

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
      const tenantRes = await supabase
        .from("tenants")
        .select("hourly_rate_eur, avg_handling_time_minutes, opening_hours")
        .eq("id", tenantId)
        .single();

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
  const verticalId = tenant ? resolveVertical(tenant).id : "base";

  async function handleSaveWirkung() {
    if (!tenant) return;
    setWirkungSaving(true);
    setWirkungMsg("");

    const res = await authedFetch("/api/settings/wirkung", {
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

  const inputStyle = inputDark;

  const sectionStyle = {
    ...glass,
    borderRadius: "14px",
    padding: "20px 24px",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: t.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <DashboardShell sidebar={<Sidebar role={role} tenantName={tenant?.name} />}>

      <div style={{
        ...topbar,
        padding: "22px 28px",
        ...revealStyle(0),
      }}>
        <p style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: "24px",
          fontWeight: 400,
          color: t.text,
          letterSpacing: "-0.3px",
        }}>
          Integrationen für{" "}
          <span style={{ fontStyle: "italic", color: t.greenAccent }}>
            {tenant?.name ?? ""}
          </span>
        </p>
        <p style={{ fontSize: "12px", color: t.textMuted, marginTop: "4px" }}>
          Verbinde deinen Bot mit externen Tools – Leads werden automatisch weitergeleitet.
        </p>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: "640px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Integrationen (registry-getrieben, geteilt mit dem Admin) */}
        <div style={revealStyle(0.05)}>
          <IntegrationsEditor
            tenantId={tenant!.id}
            verticalId={verticalId}
            theme={editorTheme}
          />
        </div>

        {/* Section heading: Wirkung */}
        <div style={{ marginTop: "32px", marginBottom: "4px", ...revealStyle(0.22) }}>
          <p style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "22px",
            color: t.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}>
            Wirkung berechnen
          </p>
          <p style={{ fontSize: "12.5px", color: t.textMuted, marginTop: "4px" }}>
            Diese Werte fließen in das Wirkung-Dashboard ein – Zeit- und Kostenersparnis basieren darauf.
          </p>
        </div>

        {/* Berechnung */}
        <div style={{ ...sectionStyle, ...revealStyle(0.25) }}>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>Berechnung der Wirkung</p>
            <p style={{ fontSize: "11.5px", color: t.textMuted, marginTop: "2px" }}>
              Wie viel ist eine Mitarbeiterstunde wert – und wie lange dauert eine typische Anfrage?
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "11px", color: t.textSecondary, display: "block", marginBottom: "5px", fontWeight: 500 }}>
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
                onFocus={(e) => e.currentTarget.style.borderColor = t.greenBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}
              />
              <p style={{ fontSize: "10.5px", color: t.textMuted, marginTop: "5px" }}>
                Wird verwendet, um die Kostenersparnis zu berechnen.
              </p>
            </div>
            <div>
              <label style={{ fontSize: "11px", color: t.textSecondary, display: "block", marginBottom: "5px", fontWeight: 500 }}>
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
                onFocus={(e) => e.currentTarget.style.borderColor = t.greenBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}
              />
              <p style={{ fontSize: "10.5px", color: t.textMuted, marginTop: "5px" }}>
                Wie lange würde ein Mitarbeiter durchschnittlich für eine Anfrage am Telefon brauchen?
              </p>
            </div>
          </div>
        </div>

        {/* Öffnungszeiten */}
        <div style={{ ...sectionStyle, ...revealStyle(0.3) }}>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>Öffnungszeiten</p>
            <p style={{ fontSize: "11.5px", color: t.textMuted, marginTop: "2px" }}>
              Anfragen außerhalb dieser Zeiten zählen als „nach Feierabend abgefangen&ldquo;.
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
                  <p style={{ fontSize: "13px", color: t.text, fontWeight: 500 }}>{d.label}</p>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: t.textSecondary }}>
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={(e) => setDayOpen(d.key, e.target.checked)}
                      style={{ accentColor: t.greenAccent }}
                    />
                    {isOpen ? "Geöffnet" : "Geschlossen"}
                  </label>
                  <input
                    type="time"
                    value={hours?.open ?? "08:00"}
                    disabled={!isOpen}
                    onChange={(e) => setDayTime(d.key, "open", e.target.value)}
                    style={{ ...inputStyle, colorScheme: "dark", opacity: isOpen ? 1 : 0.4 }}
                  />
                  <input
                    type="time"
                    value={hours?.close ?? "18:00"}
                    disabled={!isOpen}
                    onChange={(e) => setDayTime(d.key, "close", e.target.value)}
                    style={{ ...inputStyle, colorScheme: "dark", opacity: isOpen ? 1 : 0.4 }}
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
              ...ctaPrimary,
              borderRadius: "9px", padding: "10px 20px", fontSize: "13px",
              opacity: wirkungSaving ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!wirkungSaving) e.currentTarget.style.filter = "brightness(1.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            {wirkungSaving ? "Wird gespeichert..." : "Wirkungs-Einstellungen speichern"}
          </button>
          {wirkungMsg && (
            <span style={{ fontSize: "12px", color: wirkungMsg.includes("Fehler") ? t.danger : t.greenAccent }}>
              {wirkungMsg}
            </span>
          )}
        </div>

      </div>
    </DashboardShell>
  );
}