"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { t, glass, topbar, DashboardShell, leadTypeStyle, statusStyleDark } from "@/lib/dashboardTheme";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  type: string;
  status: string;
  created_at: string;
};

export default function LeadsPage() {
  const router = useRouter();
  const { tenant, role, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filter, setFilter] = useState<string>("alle");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    async function loadData() {
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, email, phone, message, type, status, created_at")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      setLeads(leadsData ?? []);
      setDataLoading(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    }
    loadData();
  }, [tenant?.id]);

  const loading = authLoading || dataLoading;

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
    return leadTypeStyle(type);
  }

  function statusLabel(s: string) {
    return statusStyleDark(s).label;
  }

  function statusStyle(s: string) {
    return statusStyleDark(s);
  }

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  const filteredLeads = filter === "alle"
    ? leads
    : leads.filter(l => l.status === filter);

  const counts = {
    alle: leads.length,
    neu: leads.filter(l => l.status === "neu").length,
    in_bearbeitung: leads.filter(l => l.status === "in_bearbeitung").length,
    erledigt: leads.filter(l => l.status === "erledigt").length,
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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...revealStyle(0),
      }}>
        <div>
          <p style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "24px",
            fontWeight: 400,
            color: t.text,
            letterSpacing: "-0.3px",
          }}>
            Leads für{" "}
            <span style={{ fontStyle: "italic", color: t.greenAccent }}>
              {tenant?.name ?? ""}
            </span>
          </p>
          <p style={{ fontSize: "12px", color: t.textMuted, marginTop: "4px" }}>
            {leads.length} Leads gesamt
          </p>
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px" }}>

        <div style={{ display: "flex", gap: "6px", ...revealStyle(0.05) }}>
          {[
            { key: "alle", label: "Alle" },
            { key: "neu", label: "Neu" },
            { key: "in_bearbeitung", label: "In Bearbeitung" },
            { key: "erledigt", label: "Erledigt" },
          ].map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: "7px 15px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: active ? 500 : 400,
                  border: active ? `1px solid ${t.greenBorder}` : `1px solid ${t.border}`,
                  background: active ? t.greenSoft : "rgba(255,255,255,0.55)",
                  color: active ? t.greenAccent : t.textMuted,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: "6px", fontSize: "10px",
                  background: active ? "rgba(26,92,58,0.16)" : "rgba(18,30,22,0.06)",
                  color: active ? t.greenAccent : t.textMuted,
                  padding: "1px 6px", borderRadius: "10px",
                }}>
                  {counts[tab.key as keyof typeof counts]}
                </span>
              </button>
            );
          })}
        </div>

        <div style={revealStyle(0.1)}>
          {filteredLeads.length === 0 ? (
            <div style={{
              ...glass,
              borderRadius: "14px", padding: "40px", textAlign: "center",
            }}>
              <p style={{ fontSize: "13px", color: t.textMuted }}>Keine Leads in dieser Kategorie.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredLeads.map((lead) => {
                const tagStyle = leadTypColor(lead.type);
                const statStyle = statusStyle(lead.status);
                return (
                  <div
                    key={lead.id}
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                    style={{
                      ...glass,
                      borderRadius: "13px", padding: "13px 16px",
                      display: "flex", alignItems: "center", gap: "12px",
                      cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = t.greenBorder;
                      e.currentTarget.style.background = "rgba(255,255,255,0.8)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.55)";
                    }}
                  >
                    <div style={{
                      width: "3px", height: "40px", borderRadius: "2px",
                      background: tagStyle.bar, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>
                          {lead.name ?? "Kein Name"}
                        </span>
                        <span style={{
                          fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
                          fontWeight: 500, background: tagStyle.bg, color: tagStyle.color,
                        }}>
                          {leadTypLabel(lead.type)}
                        </span>
                        <span style={{
                          fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
                          fontWeight: 500, background: statStyle.bg, color: statStyle.color,
                        }}>
                          {statusLabel(lead.status)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: "12px", color: t.textMuted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: "400px",
                      }}>
                        {lead.message}
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "3px" }}>
                        {lead.email && <span style={{ fontSize: "11px", color: t.textFaint }}>✉ {lead.email}</span>}
                        {lead.phone && <span style={{ fontSize: "11px", color: t.textFaint }}>✆ {lead.phone}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", color: t.textFaint }}>{formatDate(lead.created_at)}</span>
                      <span style={{ fontSize: "11px", color: t.textMuted }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardShell>
  );
}
