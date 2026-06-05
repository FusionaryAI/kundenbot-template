"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { t, glass, ctaPrimary, inputDark, topbar, DashboardShell, leadTypeStyle } from "@/lib/dashboardTheme";

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

  function leadTypLabel(type: string) {
    return leadTypeStyle(type).label;
  }

  function leadTypColor(type: string) {
    const s = leadTypeStyle(type);
    return { bg: s.bg, color: s.color };
  }

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  const sectionStyle = {
    ...glass,
    borderRadius: "14px",
    padding: "20px 24px",
  };

  const inputStyle = inputDark;

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: t.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  if (!lead) return null;

  const tagStyle = leadTypColor(lead.type);

  return (
    <DashboardShell sidebar={<Sidebar role={role} tenantName={tenant?.name} />}>

      <div style={{
        ...topbar,
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
              style={{ background: "none", border: "none", color: t.textMuted, fontSize: "12px", cursor: "pointer", padding: 0 }}
            >
              ← Alle Leads
            </button>
            <span style={{ color: t.textFaint }}>/</span>
            <span style={{ fontSize: "12px", color: t.textSecondary }}>{lead.name ?? "Kein Name"}</span>
          </div>
          <p style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "23px",
            fontWeight: 400,
            color: t.text,
            letterSpacing: "-0.3px",
          }}>
            {lead.name ?? "Kein Name"}
          </p>
        </div>
        <span style={{
          fontSize: "11px", padding: "5px 13px",
          borderRadius: "20px", fontWeight: 500,
          background: tagStyle.bg, color: tagStyle.color,
          border: `1px solid ${t.border}`,
        }}>
          {leadTypLabel(lead.type)}
        </span>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "16px" }}>

          <div style={{ ...sectionStyle, ...revealStyle(0.05) }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: t.text, marginBottom: "16px" }}>Kontaktdaten</p>
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
                  <p style={{ fontSize: "10.5px", color: t.textMuted, marginBottom: "3px", fontWeight: 500 }}>{field.label}</p>
                  <p style={{ fontSize: "13px", color: t.text }}>{field.value}</p>
                </div>
              ))}
            </div>

            {lead.type === "appointment" && (lead.appointment_topic || lead.appointment_window) && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${t.border}` }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: t.text, marginBottom: "12px" }}>Termindetails</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {lead.appointment_topic && (
                    <div>
                      <p style={{ fontSize: "10.5px", color: t.textMuted, marginBottom: "3px", fontWeight: 500 }}>Thema</p>
                      <p style={{ fontSize: "13px", color: t.text }}>{lead.appointment_topic}</p>
                    </div>
                  )}
                  {lead.appointment_window && (
                    <div>
                      <p style={{ fontSize: "10.5px", color: t.textMuted, marginBottom: "3px", fontWeight: 500 }}>Zeitwunsch</p>
                      <p style={{ fontSize: "13px", color: t.text }}>{lead.appointment_window}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...sectionStyle, ...revealStyle(0.1) }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: t.text, marginBottom: "12px" }}>Nachricht</p>
            <p style={{
              fontSize: "13px", color: t.textSecondary, lineHeight: 1.7,
              background: "rgba(18,30,22,0.04)", padding: "14px 16px",
              borderRadius: "10px", border: `1px solid ${t.border}`,
            }}>
              {lead.message}
            </p>
          </div>

          <div style={{ ...sectionStyle, ...revealStyle(0.15) }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: t.text, marginBottom: "16px" }}>Status & Notizen</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={{ fontSize: "10.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 500 }}>Status</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[
                    { key: "neu", label: "Neu", bg: t.greenSoft, color: t.greenAccent, brd: t.greenBorder },
                    { key: "in_bearbeitung", label: "In Bearbeitung", bg: t.amberSoft, color: t.amber, brd: t.amberBorder },
                    { key: "erledigt", label: "Erledigt", bg: t.greenSoft, color: t.greenAccent, brd: t.greenBorder },
                  ].map((s) => {
                    const active = status === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setStatus(s.key)}
                        style={{
                          padding: "7px 15px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: active ? 600 : 400,
                          border: active ? `1.5px solid ${s.brd}` : `1px solid ${t.border}`,
                          background: active ? s.bg : "rgba(255,255,255,0.55)",
                          color: active ? s.color : t.textMuted,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p style={{ fontSize: "10.5px", color: t.textMuted, marginBottom: "6px", fontWeight: 500 }}>Interne Notizen</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notizen für das Team..."
                  rows={4}
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = t.greenBorder}
                  onBlur={(e) => e.currentTarget.style.borderColor = t.border}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    ...ctaPrimary,
                    borderRadius: "9px", padding: "10px 20px", fontSize: "13px",
                    opacity: saving ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = "brightness(1.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
                >
                  {saving ? "Wird gespeichert..." : "Speichern"}
                </button>
                {saveMsg && (
                  <span style={{ fontSize: "12px", color: saveMsg.includes("Fehler") ? t.danger : t.greenAccent }}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
    </DashboardShell>
  );
}