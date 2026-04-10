"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  type: string;
  created_at: string;
};

type TenantSettings = {
  welcome_message: string | null;
  fallback_message: string | null;
  lead_enabled: boolean | null;
  lead_email: string | null;
  lead_auto_reply: string | null;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMsg, setCreateUserMsg] = useState("");

  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [fallbackMsg, setFallbackMsg] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadEnabled, setLeadEnabled] = useState(true);
  const [leadAutoReply, setLeadAutoReply] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).single();

      if (!roleData || roleData.role !== "super_admin") {
        router.push("/dashboard"); return;
      }

      const { data: tenantData } = await supabase
        .from("tenants").select("id, name, slug").eq("slug", slug).single();

      if (!tenantData) { router.push("/admin"); return; }
      setTenant(tenantData);

      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("welcome_message, fallback_message, lead_enabled, lead_email, lead_auto_reply")
        .eq("tenant_id", tenantData.id).single();

      if (settingsData) {
        setSettings(settingsData);
        setWelcomeMsg(settingsData.welcome_message ?? "");
        setFallbackMsg(settingsData.fallback_message ?? "");
        setLeadEmail(settingsData.lead_email ?? "");
        setLeadEnabled(settingsData.lead_enabled ?? true);
        setLeadAutoReply(settingsData.lead_auto_reply ?? "");
      }

      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, email, phone, message, type, created_at")
        .eq("tenant_id", tenantData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setLeads(leadsData ?? []);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("tenant_settings")
      .update({
        welcome_message: welcomeMsg,
        fallback_message: fallbackMsg,
        lead_email: leadEmail,
        lead_enabled: leadEnabled,
        lead_auto_reply: leadAutoReply,
      })
      .eq("tenant_id", tenant.id);

    setSaving(false);
    setSaveMsg(error ? "Fehler beim Speichern." : "Gespeichert!");
    setTimeout(() => setSaveMsg(""), 3000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function leadTypLabel(t: string) {
    if (t === "appointment") return "Termin";
    if (t === "callback") return "Rückruf";
    return "Kontakt";
  }

  function leadTypColor(t: string) {
    if (t === "appointment") return { bg: "#E6F1FB", color: "#185FA5" };
    if (t === "callback") return { bg: "#FAEEDA", color: "#854F0B" };
    return { bg: "#F1EFE8", color: "#5F5E5A" };
  }

  const inputStyle = {
    width: "100%",
    background: "#f5f5f3",
    color: "#111",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    border: "0.5px solid rgba(0,0,0,0.12)",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    fontSize: "11px",
    color: "#888",
    display: "block" as const,
    marginBottom: "4px",
  };

  const sectionStyle = {
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.08)",
    borderRadius: "12px",
    padding: "20px 24px",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f5f3" }}>
      <Sidebar role="super_admin" tenantName="Fusionary AI" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          background: "#fff",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => router.push("/admin")}
                style={{ background: "none", border: "none", color: "#888", fontSize: "13px", cursor: "pointer", padding: 0 }}
              >
                ← Alle Kunden
              </button>
              <span style={{ color: "#ccc" }}>/</span>
              <span style={{ fontSize: "13px", color: "#111", fontWeight: 500 }}>{tenant?.name}</span>
            </div>
            <p style={{ fontSize: "12px", color: "#888", marginTop: "3px" }}>
              Einstellungen, Leads & Zugang verwalten
            </p>
          </div>
          <button
            onClick={() => router.push(`/admin/${slug}/knowledge`)}
            style={{
              fontSize: "13px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "0.5px solid rgba(0,0,0,0.15)",
              background: "transparent",
              color: "#444",
              cursor: "pointer",
            }}
          >
            Wissensbasis →
          </button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Bot-Einstellungen */}
          <div style={sectionStyle}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", marginBottom: "16px" }}>
              Bot-Einstellungen
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Willkommensnachricht</label>
                <input value={welcomeMsg} onChange={(e) => setWelcomeMsg(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fallback-Nachricht</label>
                <input value={fallbackMsg} onChange={(e) => setFallbackMsg(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lead-E-Mail (wohin werden Leads gesendet)</label>
                <input value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Auto-Reply an den Nutzer nach Lead</label>
                <input value={leadAutoReply} onChange={(e) => setLeadAutoReply(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="lead-enabled"
                  checked={leadEnabled}
                  onChange={(e) => setLeadEnabled(e.target.checked)}
                  style={{ width: "14px", height: "14px", accentColor: "#111" }}
                />
                <label htmlFor="lead-enabled" style={{ fontSize: "13px", color: "#444" }}>
                  Lead-Erfassung aktiv
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: "#111", color: "#fff", border: "none",
                    borderRadius: "8px", padding: "8px 18px", fontSize: "13px",
                    fontWeight: 500, cursor: "pointer", opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? "Wird gespeichert..." : "Speichern"}
                </button>
                {saveMsg && (
                  <span style={{ fontSize: "12px", color: saveMsg.includes("Fehler") ? "#E24B4A" : "#3B6D11" }}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Leads */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>Leads</p>
              <span style={{ fontSize: "12px", color: "#888" }}>{leads.length} gesamt</span>
            </div>

            {leads.length === 0 ? (
              <div style={{ ...sectionStyle, textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#aaa" }}>Noch keine Leads vorhanden.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {leads.map((lead) => {
                  const tagStyle = leadTypColor(lead.type);
                  return (
                    <div key={lead.id} style={{
                      background: "#fff",
                      border: "0.5px solid rgba(0,0,0,0.08)",
                      borderRadius: "12px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>
                            {lead.name ?? "Kein Name"}
                          </span>
                          <span style={{
                            fontSize: "11px", padding: "2px 8px", borderRadius: "20px",
                            background: tagStyle.bg, color: tagStyle.color, fontWeight: 500,
                          }}>
                            {leadTypLabel(lead.type)}
                          </span>
                        </div>
                        <p style={{
                          fontSize: "12px", color: "#666",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "400px",
                        }}>
                          {lead.message}
                        </p>
                        <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                          {lead.email && <span style={{ fontSize: "11px", color: "#aaa" }}>✉ {lead.email}</span>}
                          {lead.phone && <span style={{ fontSize: "11px", color: "#aaa" }}>✆ {lead.phone}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", color: "#aaa", flexShrink: 0 }}>
                        {formatDate(lead.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kunden-Zugang */}
          <div style={sectionStyle}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", marginBottom: "4px" }}>
              Kunden-Zugang anlegen
            </p>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
              Erstelle einen Login für deinen Kunden.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>E-Mail des Kunden</label>
                <input
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="kunde@beispiel.de"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Passwort</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={async () => {
                    if (!tenant || !newUserEmail || !newUserPassword) return;
                    setCreatingUser(true);
                    setCreateUserMsg("");
                    const res = await fetch("/api/create-client-user", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: newUserEmail,
                        password: newUserPassword,
                        tenant_id: tenant.id,
                      }),
                    });
                    const data = await res.json();
                    setCreatingUser(false);
                    if (data.ok) {
                      setCreateUserMsg(`Zugang für ${data.email} erfolgreich angelegt!`);
                      setNewUserEmail("");
                      setNewUserPassword("");
                    } else {
                      setCreateUserMsg(`Fehler: ${data.error}`);
                    }
                    setTimeout(() => setCreateUserMsg(""), 5000);
                  }}
                  disabled={creatingUser || !newUserEmail || !newUserPassword}
                  style={{
                    background: "#111", color: "#fff", border: "none",
                    borderRadius: "8px", padding: "8px 18px", fontSize: "13px",
                    fontWeight: 500, cursor: "pointer",
                    opacity: creatingUser || !newUserEmail || !newUserPassword ? 0.5 : 1,
                  }}
                >
                  {creatingUser ? "Wird angelegt..." : "Zugang anlegen"}
                </button>
                {createUserMsg && (
                  <span style={{ fontSize: "12px", color: createUserMsg.includes("Fehler") ? "#E24B4A" : "#3B6D11" }}>
                    {createUserMsg}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}