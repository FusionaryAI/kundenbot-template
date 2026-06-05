"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { t, glass, ctaPrimary, topbar, DashboardShell } from "@/lib/dashboardTheme";

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

  function leadTypColor(type: string) {
    if (type === "appointment") return { bg: t.greenSoft, color: t.greenAccent, bar: t.greenAccent };
    if (type === "callback") return { bg: t.amberSoft, color: t.amber, bar: t.amber };
    return { bg: "rgba(18,30,22,0.06)", color: t.textSecondary, bar: "rgba(18,30,22,0.20)" };
  }

  const appointmentCount = leads.filter(l => l.type === "appointment").length;

  function trendLabel(current: number, prev: number): { label: string; color: string } | null {
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return { label: `+${current} ↑`, color: t.greenAccent };
    const delta = current - prev;
    if (delta === 0) return { label: "±0", color: t.textMuted };
    if (delta > 0) return { label: `+${delta} ↑`, color: t.greenAccent };
    return { label: `${delta} ↓`, color: t.amber };
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
      <div style={{ display: "flex", minHeight: "100vh", background: t.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: t.textMuted, fontSize: "13px" }}>Wird geladen…</p>
      </div>
    );
  }

  const stats = [
    { label: "Leads diesen Monat", value: thisMonthCount, trend: leadTrend, Icon: IconTrendUp },
    { label: "Terminanfragen", value: appointmentCount, trend: null, Icon: IconCalendar },
    { label: "Wissensbasis", value: kbCount, trend: null, Icon: IconBook },
  ];

  return (
    <DashboardShell sidebar={<Sidebar role={role} tenantName={tenant?.name} />}>

      {/* Header */}
      <div style={{
        ...topbar,
        padding: "20px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...revealStyle(0),
      }}>
        <div>
          <p style={{
            fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
            fontSize: "22px",
            fontWeight: 600,
            color: t.text,
            letterSpacing: "-0.3px",
            lineHeight: 1.2,
          }}>
            Willkommen,{" "}
            <span style={{ color: t.greenAccent }}>
              {tenant?.name ?? ""}
            </span>
          </p>
          <p style={{ fontSize: "12px", color: t.textMuted, marginTop: "3px" }}>
            Hier ist deine aktuelle Übersicht.
          </p>
        </div>
        <div style={{
          fontSize: "11px", padding: "6px 13px",
          borderRadius: "20px", background: t.greenSoft,
          color: t.greenAccent, fontWeight: 500,
          display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${t.greenBorder}`, whiteSpace: "nowrap",
        }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.greenAccent, boxShadow: `0 0 8px ${t.greenAccent}` }} />
          Bot aktiv
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
          {stats.map((stat, i) => {
            const isPrimary = i === 0;
            return (
              <div
                key={stat.label}
                style={{
                  ...glass,
                  borderRadius: "16px",
                  padding: isPrimary ? "22px 24px" : "18px 20px",
                  cursor: "default",
                  ...revealStyle(0.1 + i * 0.08),
                  transition: `transform 0.15s, box-shadow 0.15s, opacity 0.5s ease ${0.1 + i * 0.08}s`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{
                  width: isPrimary ? "32px" : "28px",
                  height: isPrimary ? "32px" : "28px",
                  borderRadius: "9px",
                  background: t.greenSoft,
                  border: `1px solid ${t.greenBorder}`,
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                  marginBottom: isPrimary ? "16px" : "12px",
                  color: t.greenAccent,
                }}>
                  <stat.Icon />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "9px" }}>
                  <p style={{
                    fontSize: isPrimary ? "34px" : "26px",
                    fontWeight: 600,
                    color: t.text,
                    letterSpacing: "-0.5px",
                    fontFamily: "var(--font-instrument-serif), Georgia, serif",
                  }}>
                    {stat.value}
                  </p>
                  {stat.trend && (
                    <span style={{
                      fontSize: "12px", fontWeight: 500,
                      color: stat.trend.color,
                    }}>
                      {stat.trend.label}
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: "12px",
                  color: t.textMuted,
                  marginTop: "3px",
                }}>
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Letzte Leads */}
        <div style={revealStyle(0.35)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "11px", padding: "0 4px" }}>
            <p style={{ fontSize: "12.5px", fontWeight: 600, color: t.text, letterSpacing: "0.01em" }}>Letzte Leads</p>
            <button
              onClick={() => router.push("/dashboard/leads")}
              style={{ fontSize: "11.5px", color: t.greenAccent, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
            >
              Alle anzeigen →
            </button>
          </div>

          {leads.length === 0 ? (
            <div style={{
              ...glass,
              borderRadius: "16px", padding: "40px 32px", textAlign: "center",
            }}>
              <p style={{ fontSize: "15px", fontWeight: 600, color: t.text, marginBottom: "6px", fontFamily: "var(--font-instrument-serif), Georgia, serif" }}>
                Dein Bot ist bereit
              </p>
              <p style={{ fontSize: "12.5px", color: t.textMuted, marginBottom: "20px" }}>
                Noch keine Leads — baue die Wissensbasis aus oder teste den Bot direkt.
              </p>
              <div style={{ display: "flex", gap: "9px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => router.push("/dashboard/knowledge")}
                  style={{
                    ...ctaPrimary,
                    borderRadius: "9px", padding: "9px 18px", fontSize: "12.5px",
                  }}
                >
                  Wissensbasis aufbauen →
                </button>
                <button
                  onClick={() => tenant && window.open(`/embed/${tenant.slug}`, "_blank")}
                  style={{
                    background: "rgba(255,255,255,0.6)", color: t.textSecondary, border: `1px solid ${t.border}`,
                    borderRadius: "9px", padding: "9px 18px", fontSize: "12.5px",
                    fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Bot testen →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {leads.map((lead) => {
                const tagStyle = leadTypColor(lead.type);
                return (
                  <div
                    key={lead.id}
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                    style={{
                      ...glass,
                      borderRadius: "13px", padding: "12px 15px",
                      display: "flex", alignItems: "center", gap: "12px",
                      cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.8)";
                      e.currentTarget.style.borderColor = t.greenBorder;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.55)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)";
                    }}
                  >
                    <div style={{ width: "3px", height: "36px", borderRadius: "2px", background: tagStyle.bar, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, color: t.text }}>
                          {lead.name ?? "Kein Name"}
                        </span>
                        <span style={{
                          fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
                          fontWeight: 500, background: tagStyle.bg, color: tagStyle.color,
                        }}>
                          {leadTypLabel(lead.type)}
                        </span>
                      </div>
                      <p style={{ fontSize: "11.5px", color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "380px" }}>
                        {lead.message}
                      </p>
                    </div>
                    <span style={{ fontSize: "10.5px", color: t.textMuted, flexShrink: 0 }}>
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
            ...glass,
            borderRadius: "16px", padding: "18px 22px",
            ...revealStyle(0.45),
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <p style={{ fontSize: "12.5px", fontWeight: 600, color: t.text }}>Bot einbinden</p>
                <p style={{ fontSize: "11px", color: t.textMuted, marginTop: "3px" }}>
                  Diesen Code in deine Website einfügen
                </p>
              </div>
              <button
                onClick={copyEmbed}
                style={{
                  background: copied ? t.greenSoft : "rgba(255,255,255,0.6)",
                  color: copied ? t.greenAccent : t.textSecondary,
                  border: `1px solid ${copied ? t.greenBorder : t.border}`,
                  borderRadius: "8px",
                  padding: "7px 15px",
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
              background: "rgba(18,30,22,0.05)",
              border: `1px solid ${t.border}`,
              borderRadius: "10px",
              padding: "12px 15px",
              fontFamily: "monospace",
              fontSize: "11.5px",
              color: t.green,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}>
              {embedSnippet}
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
