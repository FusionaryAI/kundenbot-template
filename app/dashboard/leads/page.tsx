"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
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

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [kbCount, setKbCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

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

      if (tenantId) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name, email, phone, message, type, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20);
        setLeads(leadsData ?? []);

        const { count } = await supabase
          .from("knowledge_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        setKbCount(count ?? 0);
      }

      setLoading(false);
      setTimeout(() => setRevealed(true), 50);
    }
    load();
  }, [router]);

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

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
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
              <span style={{
                fontWeight: 600,
                fontStyle: "italic",
                color: "#2d5a1b",
              }}>
                {tenant?.name ?? ""}
              </span>
            </p>
            <p style={{ fontSize: "12px", color: "#bbb", marginTop: "4px" }}>
              Hier ist deine aktuelle Übersicht.
            </p>
          </div>
          <div style={{
            fontSize: "11px",
            padding: "5px 12px",
            borderRadius: "20px",
            background: "#edf5e4",
            color: "#3a6b10",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            border: "0.5px solid #c8e0a0",
          }}>
            <div style={{
              width: "5px", height: "5px",
              borderRadius: "50%",
              background: "#5a9a1a",
            }} />
            Bot aktiv
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Statistik-Karten */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "10px" }}>
            {[
              { label: "Leads gesamt", value: leads.length, sub: "diesen Monat", icon: "📊", bg: "#f0eeff" },
              { label: "Terminanfragen", value: appointmentCount, sub: "offen", icon: "📅", bg: "#eef4ff" },
              { label: "Wissensbasis", value: kbCount, sub: "Einträge", icon: "📚", bg: "#edf7e4" },
            ].map((stat, i) => (
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
                  e.currentTarget.style.transform = revealed ? "translateY(0)" : "translateY(10px)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: "28px", height: "28px",
                  borderRadius: "7px",
                  background: stat.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  marginBottom: "10px",
                }}>
                  {stat.icon}
                </div>
                <p style={{ fontSize: "22px", fontWeight: 700, color: "#0a0a0a", letterSpacing: "-0.5px" }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Leads */}
          <div style={revealStyle(0.35)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#333" }}>Letzte Leads</p>
              <span style={{ fontSize: "11px", color: "#bbb" }}>{leads.length} gesamt</span>
            </div>

            {leads.length === 0 ? (
              <div style={{
                background: "#fff",
                border: "1px solid #efefed",
                borderRadius: "10px",
                padding: "32px",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "13px", color: "#bbb" }}>Noch keine Leads vorhanden.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {leads.map((lead) => {
                  const tagStyle = leadTypColor(lead.type);
                  return (
                    <div
                      key={lead.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #efefed",
                        borderRadius: "9px",
                        padding: "11px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        transition: "all 0.15s",
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
                      <div style={{
                        width: "3px", height: "36px",
                        borderRadius: "2px",
                        background: tagStyle.bar,
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "2px" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0a0a0a" }}>
                            {lead.name ?? "Kein Name"}
                          </span>
                          <span style={{
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "20px",
                            background: tagStyle.bg,
                            color: tagStyle.color,
                            fontWeight: 500,
                          }}>
                            {leadTypLabel(lead.type)}
                          </span>
                        </div>
                        <p style={{
                          fontSize: "11.5px", color: "#aaa",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          maxWidth: "380px",
                        }}>
                          {lead.message}
                        </p>
                        <div style={{ display: "flex", gap: "10px", marginTop: "3px" }}>
                          {lead.email && <span style={{ fontSize: "10.5px", color: "#bbb" }}>✉ {lead.email}</span>}
                          {lead.phone && <span style={{ fontSize: "10.5px", color: "#bbb" }}>✆ {lead.phone}</span>}
                        </div>
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

        </div>
      </div>
    </div>
  );
}