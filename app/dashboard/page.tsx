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
    if (t === "appointment") return { bg: "#E6F1FB", color: "#185FA5" };
    if (t === "callback") return { bg: "#FAEEDA", color: "#854F0B" };
    return { bg: "#F1EFE8", color: "#5F5E5A" };
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  }

  const appointmentCount = leads.filter(l => l.type === "appointment").length;

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f5f3" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

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
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#111" }}>
              {greeting()}{tenant ? `, ${tenant.name}` : ""} 👋
            </p>
            <p style={{ fontSize: "12px", color: "#888", marginTop: "3px" }}>
              Hier ist deine aktuelle Übersicht.
            </p>
          </div>
          <div style={{
            fontSize: "11px",
            padding: "4px 10px",
            borderRadius: "20px",
            background: "#EAF3DE",
            color: "#3B6D11",
            fontWeight: 500,
          }}>
            Bot aktiv
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Statistik-Karten */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "12px" }}>
            {[
              { label: "Leads gesamt", value: leads.length, sub: "diesen Monat" },
              { label: "Terminanfragen", value: appointmentCount, sub: "offen" },
              { label: "Wissensbasis", value: kbCount, sub: "Einträge" },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                padding: "16px 20px",
              }}>
                <p style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>{stat.label}</p>
                <p style={{ fontSize: "24px", fontWeight: 500, color: "#111" }}>{stat.value}</p>
                <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Leads */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>Letzte Leads</p>
              <span style={{ fontSize: "12px", color: "#888" }}>{leads.length} gesamt</span>
            </div>

            {leads.length === 0 ? (
              <div style={{
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                padding: "32px",
                textAlign: "center",
              }}>
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
                            fontSize: "11px",
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
                          fontSize: "12px",
                          color: "#666",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "400px",
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

          {/* Bot Status */}
          {tenant && (
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", marginBottom: "12px" }}>Bot-Status</p>
              <div style={{
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "8px", height: "8px",
                    borderRadius: "50%",
                    background: "#639922",
                  }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>{tenant.name}</p>
                    <p style={{ fontSize: "11px", color: "#aaa", marginTop: "1px" }}>
                      Slug: {tenant.slug}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/dashboard/knowledge")}
                  style={{
                    fontSize: "12px",
                    padding: "5px 12px",
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
            </div>
          )}

        </div>
      </div>
    </div>
  );
}