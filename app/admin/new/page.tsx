"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import Sidebar from "@/components/Sidebar";
import { listVerticals } from "@/lib/verticals/registry";

const VERTICAL_OPTIONS = listVerticals().map((v) => ({ id: v.id, label: v.label }));

export default function NewTenantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [vertical, setVertical] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("Hallo! Wie kann ich Ihnen helfen?");
  const [fallbackMsg, setFallbackMsg] = useState("Dazu habe ich leider keine Informationen. Soll ich Ihre Anfrage ans Team weiterleiten?");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadAutoReply, setLeadAutoReply] = useState("Vielen Dank! Wir melden uns zeitnah.");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit() {
    if (!name || !slug || !leadEmail || !clientEmail || !clientPassword) {
      setMsg("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setSaving(true);
    setMsg("");

    const res = await authedFetch("/api/admin/create-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, slug,
        vertical: vertical || null,
        welcome_message: welcomeMsg,
        fallback_message: fallbackMsg,
        lead_email: leadEmail,
        lead_auto_reply: leadAutoReply,
        client_email: clientEmail,
        client_password: clientPassword,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.ok) {
      router.push(`/admin/${slug}`);
    } else {
      setMsg(`Fehler: ${data.error}`);
    }
  }

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
  };

  const labelStyle = {
    fontSize: "11px",
    color: "#999",
    display: "block" as const,
    marginBottom: "5px",
    fontWeight: 500,
  };

  const sectionStyle = {
    background: "#fff",
    border: "1px solid #efefed",
    borderRadius: "10px",
    padding: "20px 24px",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      <Sidebar role="super_admin" tenantName="Fusionary AI" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #efefed",
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
              <button
                onClick={() => router.push("/admin")}
                style={{ background: "none", border: "none", color: "#bbb", fontSize: "12px", cursor: "pointer", padding: 0 }}
              >
                ← Alle Kunden
              </button>
              <span style={{ color: "#e0e0e0" }}>/</span>
              <span style={{ fontSize: "12px", color: "#999" }}>Neuen Kunden anlegen</span>
            </div>
            <p style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "22px",
              fontWeight: 400,
              color: "#0a0a0a",
              letterSpacing: "-0.3px",
            }}>
              Neuen Kunden anlegen
            </p>
          </div>
        </div>

        <div style={{ padding: "24px 28px", maxWidth: "680px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Kundeninfos */}
          <div style={sectionStyle}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "16px" }}>
              Kundeninformationen
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Name des Unternehmens <span style={{ color: "#e05" }}>*</span></label>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSlug(generateSlug(e.target.value)); }}
                  placeholder="z.B. Hausarztpraxis Mustermann"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                />
              </div>
              <div>
                <label style={labelStyle}>Slug (URL-Kürzel) <span style={{ color: "#e05" }}>*</span></label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="z.B. hausarzt-mustermann"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                />
                <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "4px" }}>
                  Bot-URL: /embed/{slug || "..."}
                </p>
              </div>
              <div>
                <label style={labelStyle}>Branche / Bot-Profil</label>
                <select
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                >
                  <option value="">Automatisch (anhand des Namens erkennen)</option>
                  {VERTICAL_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: "10.5px", color: "#bbb", marginTop: "4px" }}>
                  Bestimmt Guardrails &amp; Verhalten. „Automatisch&ldquo; nutzt die Namens-Heuristik
                  (z.B. „Praxis&ldquo; → Arzt-Profil).
                </p>
              </div>
            </div>
          </div>

          {/* Bot Einstellungen */}
          <div style={sectionStyle}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "16px" }}>
              Bot-Einstellungen
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Willkommensnachricht</label>
                <input value={welcomeMsg} onChange={(e) => setWelcomeMsg(e.target.value)} style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"} />
              </div>
              <div>
                <label style={labelStyle}>Fallback-Nachricht</label>
                <input value={fallbackMsg} onChange={(e) => setFallbackMsg(e.target.value)} style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"} />
              </div>
              <div>
                <label style={labelStyle}>Lead-E-Mail <span style={{ color: "#e05" }}>*</span></label>
                <input value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="kunde@beispiel.de" style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"} />
              </div>
              <div>
                <label style={labelStyle}>Auto-Reply nach Lead</label>
                <input value={leadAutoReply} onChange={(e) => setLeadAutoReply(e.target.value)} style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"} />
              </div>
            </div>
          </div>

          {/* Kunden-Login */}
          <div style={sectionStyle}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "16px" }}>
              Dashboard-Zugang für Kunden
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>E-Mail des Kunden <span style={{ color: "#e05" }}>*</span></label>
                <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="kunde@beispiel.de" style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"} />
              </div>
              <div>
                <label style={labelStyle}>Passwort <span style={{ color: "#e05" }}>*</span></label>
                <input type="password" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen" style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"} />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Wird angelegt..." : "Kunden anlegen"}
            </button>
            {msg && (
              <span style={{ fontSize: "12px", color: msg.includes("Fehler") ? "#e05" : "#3a6b10" }}>
                {msg}
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}