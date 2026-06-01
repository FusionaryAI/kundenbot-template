"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  type: string;
  status: string;
  created_at: string;
  preferred_contact: string | null;
  appointment_topic: string | null;
  appointment_window: string | null;
  metadata: any;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("neu");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!roleData) { router.push("/login"); return; }
      setRole(roleData.role);

      let tenantId = roleData.tenant_id;

      if (roleData.role === "super_admin") {
        const { data: firstTenant } = await supabase
          .from("tenants").select("*").limit(1).single();
        if (firstTenant) { setTenant(firstTenant); tenantId = firstTenant.id; }
      } else {
        const { data: tenantData } = await supabase
          .from("tenants").select("*").eq("id", tenantId).single();
        if (tenantData) setTenant(tenantData);
      }

      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      if (!leadData) { router.push("/dashboard/leads"); return; }

      setLead(leadData);
      setStatus(leadData.status ?? "neu");
      setNotes(leadData.metadata?.notes ?? "");
      setLoading(false);
      setTimeout(() => setRevealed(true), 50);
    }
    load();
  }, [id, router]);

  async function handleSave() {
    if (!lead) return;
    setSaving(true);
    setSaveMsg("");

    const res = await authedFetch("/api/leads/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        status,
        notes,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.ok) {
      setSaveMsg("Gespeichert!");
      setLead({
        ...lead,
        status,
        metadata: { ...(lead.metadata ?? {}), notes },
      });
    } else {
      setSaveMsg("Fehler beim Speichern.");
    }
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
    if (t === "appointment") return { bg: "#e2ede8", color: "#1a5c3a" };
    if (t === "callback") return { bg: "#fff4e6", color: "#b36000" };
    return { bg: "#f5f5f5", color: "#888" };
  }

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  const sectionStyle = {
    background: "#fff",
    border: "1px solid #e8e6e0",
    borderRadius: "10px",
    padding: "20px 24px",
  };

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

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf8", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#bbb", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  if (!lead) return null;

  const tagStyle = leadTypColor(lead.type);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf8" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e8e6e0",
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          ...revealStyle(0),
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
              <button
                onClick={() => router.push("/dashboard/leads")}
                style={{ background: "none", border: "none", color: "#bbb", fontSize: "12px", cursor: "pointer", padding: 0 }}
              >
                ← Alle Leads
              </button>
              <span style={{ color: "#e0e0e0" }}>/</span>
              <span style={{ fontSize: "12px", color: "#999" }}>{lead.name ?? "Kein Name"}</span>
            </div>
            <p style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "22px",
              fontWeight: 400,
              color: "#0a0a0a",
              letterSpacing: "-0.3px",
            }}>
              {lead.name ?? "Kein Name"}
            </p>
          </div>
          <span style={{
            fontSize: "11px", padding: "4px 12px",
            borderRadius: "20px", fontWeight: 500,
            background: tagStyle.bg, color: tagStyle.color,
            border: `1px solid ${tagStyle.color}22`,
          }}>
            {leadTypLabel(lead.type)}
          </span>
        </div>

        <div style={{ padding: "24px 28px", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "16px" }}>

          <div style={{ ...sectionStyle, ...revealStyle(0.05) }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "16px" }}>Kontaktdaten</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Name", value: lead.name ?? "–" },
                { label: "Eingegangen", value: formatDate(lead.created_at) },
                { label: "E-Mail", value: lead.email ?? "–" },
                { label: "Telefon", value: lead.phone ?? "–" },
                { label: "Bevorzugter Kontakt", value: lead.preferred_contact === "email" ? "E-Mail" : lead.preferred_contact === "phone" ? "Telefon" : "–" },
                { label: "Lead-Typ", value: leadTypLabel(lead.type) },
              ].map((field) => (
                <div key={field.label}>
                  <p style={{ fontSize: "10.5px", color: "#bbb", marginBottom: "3px", fontWeight: 500 }}>{field.label}</p>
                  <p style={{ fontSize: "13px", color: "#111" }}>{field.value}</p>
                </div>
              ))}
            </div>

            {lead.type === "appointment" && (lead.appointment_topic || lead.appointment_window) && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f5f5f5" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "12px" }}>Termindetails</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {lead.appointment_topic && (
                    <div>
                      <p style={{ fontSize: "10.5px", color: "#bbb", marginBottom: "3px", fontWeight: 500 }}>Thema</p>
                      <p style={{ fontSize: "13px", color: "#111" }}>{lead.appointment_topic}</p>
                    </div>
                  )}
                  {lead.appointment_window && (
                    <div>
                      <p style={{ fontSize: "10.5px", color: "#bbb", marginBottom: "3px", fontWeight: 500 }}>Zeitwunsch</p>
                      <p style={{ fontSize: "13px", color: "#111" }}>{lead.appointment_window}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...sectionStyle, ...revealStyle(0.1) }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "12px" }}>Nachricht</p>
            <p style={{
              fontSize: "13px", color: "#444", lineHeight: 1.7,
              background: "#fafaf8", padding: "14px 16px",
              borderRadius: "8px", border: "1px solid #e8e6e0",
            }}>
              {lead.message}
            </p>
          </div>

          <div style={{ ...sectionStyle, ...revealStyle(0.15) }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "16px" }}>Status & Notizen</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={{ fontSize: "10.5px", color: "#bbb", marginBottom: "6px", fontWeight: 500 }}>Status</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[
                    { key: "neu", label: "Neu", bg: "#e2ede8", color: "#1a5c3a" },
                    { key: "in_bearbeitung", label: "In Bearbeitung", bg: "#fff4e6", color: "#b36000" },
                    { key: "erledigt", label: "Erledigt", bg: "#edf5e4", color: "#3a6b10" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatus(s.key)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: status === s.key ? 600 : 400,
                        border: status === s.key ? `1.5px solid ${s.color}` : "1px solid #e8e6e0",
                        background: status === s.key ? s.bg : "#fff",
                        color: status === s.key ? s.color : "#bbb",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: "10.5px", color: "#bbb", marginBottom: "6px", fontWeight: 500 }}>Interne Notizen</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notizen für das Team..."
                  rows={4}
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c4d9cc"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#e8e6e0"}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: "#111", color: "#fff", border: "none",
                    borderRadius: "8px", padding: "9px 18px", fontSize: "13px",
                    fontWeight: 500, cursor: "pointer",
                    opacity: saving ? 0.6 : 1, transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "#333"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#111"; }}
                >
                  {saving ? "Wird gespeichert..." : "Speichern"}
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
      </div>
    </div>
  );
}