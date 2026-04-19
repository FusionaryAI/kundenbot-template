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
    async function loadData() {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [leadsResult, kbResult, thisMonthResult, prevMonthResult] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, email, phone, message, type, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("knowledge_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", thisMonthStart),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
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
    if (t === "appointment") return { bg: "#eeeeff", color: "#5b53d8", bar: "#5b53d8" };
    if (t === "callback") return { bg: "#fff4e6", color: "#b36000", bar: "#f0a030" };
    return { bg: "#f5f5f5", color: "#888", bar: "#ddd" };
  }

  const appointmentCount = leads.filter(l => l.type === "appointment").length;

  function trendLabel(current: number, prev: number): { label: string; color: string } | null {
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return { label: `+${current} ↑`, color: "#3a6b10" };
    const delta = current - prev;
    if (delta === 0) return { label: "±0", color: "#aaa" };
    if (delta > 0) return { label: `+${delta} ↑`, color: "#3a6b10" };
    return { label: `${delta} ↓`, color: "#c0392b" };
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
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#bbb", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  const stats = [
    { label: "Leads diesen Monat", value: thisMonthCount, trend: leadTrend, icon: "📊", bg: "#f0eeff" },
    { label: "Terminanfragen", value: appointmentCount, trend: null, icon: "📅", bg: "#eef4ff" },
    { label: "Wissensbasis", value: kbCount, trend: null, icon: "📚", bg: "#edf7e4" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <div style={{
          background: "#fff",
          borderBottom: "1px solid #efefed",
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          ...revealStyle(0),
        }}>
          <div>
            <p style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "26px",
              fontWeight: 400,
              color: "#0a0a0a",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}>
              Willkommen,{" "}
              <span style={{ fontWeight: 600, fontStyle: "italic", color: "#2d5a1b" }}>
                {tenant?.name ?? ""}
              </span>
            </p>
            <p style={{ fontSize: "12px", color: "#bbb", marginTop: "4px" }}>
              Hier ist deine aktuelle Übersicht.
            </p>
          </div>
          <div style={{
            fontSize: "11px", padding: "5px 12px",
            borderRadius: "20px", background: "#edf5e4",
            color: "#3a6b10", fontWeight: 500,
            display: "flex", alignItems: "center", gap: "5px",
            border: "0.5px solid #c8e0a0",
          }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#5a9a1a" }} />
            Bot aktiv
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "10px" }}>
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  background: "#fff",
                  border: "1px solid #efefed",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  ...revealStyle(0.1 + i * 0.08),
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#c8c4f8";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(91,83,216,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#efefed";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: "28px", height: "28px", borderRadius: "7px",
                  background: stat.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "13px", marginBottom: "10px",
                }}>
                  {stat.icon}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <p style={{ fontSize: "22px", fontWeight: 700, color: "#0a0a0a", letterSpacing: "-0.5px" }}>
                    {stat.value}
                  </p>
                  {stat.trend && (
                    <span style={{ fontSize: "11px", fontWeight: 500, color: stat.trend.color }}>
                      {stat.trend.label}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Letzte Leads */}
          <div style={revealStyle(0.35)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#333" }}>Letzte Leads</p>
              <button
                onClick={() => router.push("/dashboard/leads")}
                style={{ fontSize: "11px", color: "#5b53d8", background: "none", border: "none", cursor: "pointer" }}
              >
                Alle anzeigen →
              </button>
            </div>

            {leads.length === 0 ? (
              <div style={{
                background: "#fff", border: "1px solid #efefed",
                borderRadius: "12px", padding: "40px 32px", textAlign: "center",
              }}>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#0a0a0a", marginBottom: "6px" }}>
                  Dein Bot ist bereit
                </p>
                <p style={{ fontSize: "13px", color: "#bbb", marginBottom: "20px" }}>
                  Noch keine Leads — baue die Wissensbasis aus oder teste den Bot direkt.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => router.push("/dashboard/knowledge")}
                    style={{
                      background: "#111", color: "#fff", border: "none",
                      borderRadius: "8px", padding: "9px 16px", fontSize: "12.5px",
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Wissensbasis aufbauen →
                  </button>
                  <button
                    onClick={() => tenant && window.open(`/embed/${tenant.slug}`, "_blank")}
                    style={{
                      background: "#fff", color: "#555", border: "1px solid #efefed",
                      borderRadius: "8px", padding: "9px 16px", fontSize: "12.5px",
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Bot testen →
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {leads.map((lead) => {
                  const tagStyle = leadTypColor(lead.type);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                      style={{
                        background: "#fff", border: "1px solid #efefed",
                        borderRadius: "9px", padding: "11px 14px",
                        display: "flex", alignItems: "center", gap: "10px",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#c8c4f8";
                        e.currentTarget.style.background = "#fdfcff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#efefed";
                        e.currentTarget.style.background = "#fff";
                      }}
                    >
                      <div style={{ width: "3px", height: "36px", borderRadius: "2px", background: tagStyle.bar, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "2px" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0a0a0a" }}>
                            {lead.name ?? "Kein Name"}
                          </span>
                          <span style={{
                            fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
                            fontWeight: 500, background: tagStyle.bg, color: tagStyle.color,
                          }}>
                            {leadTypLabel(lead.type)}
                          </span>
                        </div>
                        <p style={{ fontSize: "11.5px", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "380px" }}>
                          {lead.message}
                        </p>
                      </div>
                      <span style={{ fontSize: "10.5px", color: "#ccc", flexShrink: 0 }}>
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
              background: "#fff", border: "1px solid #efefed",
              borderRadius: "10px", padding: "16px 20px",
              ...revealStyle(0.45),
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#333" }}>Bot einbinden</p>
                  <p style={{ fontSize: "11px", color: "#bbb", marginTop: "2px" }}>
                    Diesen Code in deine Website einfügen
                  </p>
                </div>
                <button
                  onClick={copyEmbed}
                  style={{
                    background: copied ? "#edf5e4" : "#f5f5f5",
                    color: copied ? "#3a6b10" : "#555",
                    border: `1px solid ${copied ? "#c8e0a0" : "#efefed"}`,
                    borderRadius: "7px",
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
                background: "#0f0f0f",
                borderRadius: "7px",
                padding: "12px 14px",
                fontFamily: "monospace",
                fontSize: "11.5px",
                color: "#7dd3fc",
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
