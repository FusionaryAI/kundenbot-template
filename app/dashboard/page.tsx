"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  type: string;
  created_at: string;
};

const IconTrendUp = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 11l4-4 3 3 5-6"/>
    <path d="M11 4h4v4"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="3" width="14" height="11" rx="1.5"/>
    <path d="M5 1v3M11 1v3M1 7h14"/>
  </svg>
);

const IconBook = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2h5a1 1 0 011 1v11a1 1 0 01-1 1H2V2z"/>
    <path d="M8 3h5a1 1 0 011 1v10a1 1 0 01-1 1H8"/>
    <path d="M5 6H4M5 9H4"/>
  </svg>
);

export default function DashboardPage() {
  const router = useRouter();
  const { tenant, role, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [kbCount, setKbCount] = useState(0);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const [prevMonthCount, setPrevMonthCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!tenant?.id) return;
    const tenantId = tenant.id;
    async function loadData() {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [leadsResult, kbResult, thisMonthResult, prevMonthResult] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, email, phone, message, type, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("knowledge_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", thisMonthStart),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", prevMonthStart)
          .lt("created_at", thisMonthStart),
      ]);

      setLeads(leadsResult.data ?? []);
      setKbCount(kbResult.count ?? 0);
      setThisMonthCount(thisMonthResult.count ?? 0);
      setPrevMonthCount(prevMonthResult.count ?? 0);
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

  function leadTypLabel(t: string) {
    if (t === "appointment") return "Termin";
    if (t === "callback") return "Rückruf";
    return "Kontakt";
  }

  function leadTypColor(t: string) {
    if (t === "appointment") return { bg: "#e2ede8", color: "#1a5c3a", bar: "#1a5c3a" };
    if (t === "callback") return { bg: "#faeeda", color: "#85500b", bar: "#85500b" };
    return { bg: "#f1efea", color: "#888780", bar: "#d0cdc6" };
  }

  const appointmentCount = leads.filter(l => l.type === "appointment").length;

  function trendLabel(current: number, prev: number): { label: string; color: string } | null {
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return { label: `+${current} ↑`, color: "#1a5c3a" };
    const delta = current - prev;
    if (delta === 0) return { label: "±0", color: "#888780" };
    if (delta > 0) return { label: `+${delta} ↑`, color: "#1a5c3a" };
    return { label: `${delta} ↓`, color: "#85500b" };
  }

  const leadTrend = trendLabel(thisMonthCount, prevMonthCount);
  const embedSnippet = `<script src="${origin}/widget.js" data-slug="${tenant?.slug}" data-origin="${origin}"></script>`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf8", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#888780", fontSize: "13px" }}>Wird geladen…</p>
      </div>
    );
  }

  const stats = [
    { label: "Leads diesen Monat", value: thisMonthCount, trend: leadTrend, Icon: IconTrendUp, bg: "#e2ede8", iconColor: "#1a5c3a" },
    { label: "Terminanfragen", value: appointmentCount, trend: null, Icon: IconCalendar, bg: "#f1efea", iconColor: "#4a4a47" },
    { label: "Wissensbasis", value: kbCount, trend: null, Icon: IconBook, bg: "#f1efea", iconColor: "#4a4a47" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf8" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Header */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e8e6e0",
          padding: "20px 28px",
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
              color: "#0f0f0e",
              letterSpacing: "-0.2px",
              lineHeight: 1.2,
            }}>
              Willkommen,{" "}
              <span style={{ fontStyle: "italic", color: "#1a5c3a" }}>
                {tenant?.name ?? ""}
              </span>
            </p>
            <p style={{ fontSize: "12px", color: "#888780", marginTop: "3px" }}>
              Hier ist deine aktuelle Übersicht.
            </p>
          </div>
          <div style={{
            fontSize: "11px", padding: "5px 12px",
            borderRadius: "20px", background: "#e2ede8",
            color: "#1a5c3a", fontWeight: 500,
            display: "flex", alignItems: "center", gap: "5px",
            border: "1px solid #c4d9cc",
          }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#1a5c3a" }} />
            Bot aktiv
          </div>
        </div>

        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "10px" }}>
            {stats.map((stat, i) => {
              const isPrimary = i === 0;
              return (
                <div
                  key={stat.label}
                  style={{
                    background: isPrimary ? "#1a5c3a" : "#fff",
                    border: isPrimary ? "none" : "1px solid #e8e6e0",
                    borderRadius: "10px",
                    padding: isPrimary ? "20px 22px" : "16px 18px",
                    cursor: "default",
                    ...revealStyle(0.1 + i * 0.08),
                    transition: `border-color 0.15s, box-shadow 0.15s, opacity 0.5s ease ${0.1 + i * 0.08}s, transform 0.5s ease ${0.1 + i * 0.08}s`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isPrimary) {
                      e.currentTarget.style.borderColor = "#c4d9cc";
                      e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,92,58,0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPrimary) {
                      e.currentTarget.style.borderColor = "#e8e6e0";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  <div style={{
                    width: isPrimary ? "30px" : "26px",
                    height: isPrimary ? "30px" : "26px",
                    borderRadius: "7px",
                    background: isPrimary ? "rgba(255,255,255,0.15)" : stat.bg,
                    display: "flex", alignItems: "center",
                    justifyContent: "center",
                    marginBottom: isPrimary ? "14px" : "10px",
                    color: isPrimary ? "#fff" : stat.iconColor,
                  }}>
                    <stat.Icon />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <p style={{
                      fontSize: isPrimary ? "30px" : "22px",
                      fontWeight: 600,
                      color: isPrimary ? "#fff" : "#0f0f0e",
                      letterSpacing: "-0.5px",
                      fontFamily: "var(--font-instrument-serif), Georgia, serif",
                    }}>
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <span style={{
                        fontSize: "11.5px", fontWeight: 500,
                        color: isPrimary ? "rgba(255,255,255,0.65)" : stat.trend.color,
                      }}>
                        {stat.trend.label}
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: "11.5px",
                    color: isPrimary ? "rgba(255,255,255,0.55)" : "#888780",
                    marginTop: "2px",
                  }}>
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Letzte Leads */}
          <div style={revealStyle(0.35)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#0f0f0e", letterSpacing: "0.01em" }}>Letzte Leads</p>
              <button
                onClick={() => router.push("/dashboard/leads")}
                style={{ fontSize: "11.5px", color: "#1a5c3a", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
              >
                Alle anzeigen →
              </button>
            </div>

            {leads.length === 0 ? (
              <div style={{
                background: "#fff", border: "1px solid #e8e6e0",
                borderRadius: "10px", padding: "36px 32px", textAlign: "center",
              }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f0f0e", marginBottom: "5px" }}>
                  Dein Bot ist bereit
                </p>
                <p style={{ fontSize: "12.5px", color: "#888780", marginBottom: "18px" }}>
                  Noch keine Leads — baue die Wissensbasis aus oder teste den Bot direkt.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => router.push("/dashboard/knowledge")}
                    style={{
                      background: "#1a5c3a", color: "#fff", border: "none",
                      borderRadius: "7px", padding: "8px 16px", fontSize: "12.5px",
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Wissensbasis aufbauen →
                  </button>
                  <button
                    onClick={() => tenant && window.open(`/embed/${tenant.slug}`, "_blank")}
                    style={{
                      background: "#fff", color: "#4a4a47", border: "1px solid #e8e6e0",
                      borderRadius: "7px", padding: "8px 16px", fontSize: "12.5px",
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Bot testen →
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {leads.map((lead) => {
                  const tagStyle = leadTypColor(lead.type);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                      style={{
                        background: "#fff", border: "1px solid #e8e6e0",
                        borderRadius: "8px", padding: "11px 14px",
                        display: "flex", alignItems: "center", gap: "10px",
                        cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#c4d9cc";
                        e.currentTarget.style.background = "#fafaf8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e8e6e0";
                        e.currentTarget.style.background = "#fff";
                      }}
                    >
                      <div style={{ width: "3px", height: "34px", borderRadius: "2px", background: tagStyle.bar, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "2px" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0f0f0e" }}>
                            {lead.name ?? "Kein Name"}
                          </span>
                          <span style={{
                            fontSize: "10px", padding: "2px 7px", borderRadius: "20px",
                            fontWeight: 500, background: tagStyle.bg, color: tagStyle.color,
                          }}>
                            {leadTypLabel(lead.type)}
                          </span>
                        </div>
                        <p style={{ fontSize: "11.5px", color: "#888780", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "380px" }}>
                          {lead.message}
                        </p>
                      </div>
                      <span style={{ fontSize: "10.5px", color: "#888780", flexShrink: 0 }}>
                        {formatDate(lead.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Embed Code */}
          {tenant?.slug && (
            <div style={{
              background: "#fff", border: "1px solid #e8e6e0",
              borderRadius: "10px", padding: "16px 20px",
              ...revealStyle(0.45),
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#0f0f0e" }}>Bot einbinden</p>
                  <p style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                    Diesen Code in deine Website einfügen
                  </p>
                </div>
                <button
                  onClick={copyEmbed}
                  style={{
                    background: copied ? "#e2ede8" : "#f1efea",
                    color: copied ? "#1a5c3a" : "#4a4a47",
                    border: `1px solid ${copied ? "#c4d9cc" : "#e8e6e0"}`,
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {copied ? "✓ Kopiert" : "Code kopieren"}
                </button>
              </div>
              <div style={{
                background: "#0f0f0e",
                borderRadius: "6px",
                padding: "11px 14px",
                fontFamily: "monospace",
                fontSize: "11.5px",
                color: "#a8c5b4",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}>
                {embedSnippet}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
