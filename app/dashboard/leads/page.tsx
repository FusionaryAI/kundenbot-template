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
  status: string;
  created_at: string;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function LeadsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("alle");
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
      }

      if (tenantId) {
        const [tenantResult, leadsResult] = await Promise.all([
          roleData.role !== "super_admin"
            ? supabase.from("tenants").select("*").eq("id", tenantId).single()
            : Promise.resolve({ data: null }),
          supabase
            .from("leads")
            .select("id, name, email, phone, message, type, status, created_at")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false }),
        ]);

        if (tenantResult.data) setTenant(tenantResult.data);
        setLeads(leadsResult.data ?? []);
      }

      setLoading(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
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

  function statusLabel(s: string) {
    if (s === "in_bearbeitung") return "In Bearbeitung";
    if (s === "erledigt") return "Erledigt";
    return "Neu";
  }

  function statusStyle(s: string) {
    if (s === "in_bearbeitung") return { bg: "#fff4e6", color: "#b36000" };
    if (s === "erledigt") return { bg: "#edf5e4", color: "#3a6b10" };
    return { bg: "#eeeeff", color: "#5b53d8" };
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
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#bbb", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

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
              fontSize: "22px",
              fontWeight: 400,
              color: "#0a0a0a",
              letterSpacing: "-0.3px",
            }}>
              Leads für{" "}
              <span style={{ fontWeight: 600, fontStyle: "italic", color: "#2d5a1b" }}>
                {tenant?.name ?? ""}
              </span>
            </p>
            <p style={{ fontSize: "12px", color: "#bbb", marginTop: "4px" }}>
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
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: filter === tab.key ? 500 : 400,
                  border: filter === tab.key ? "1px solid #c8c4f8" : "1px solid #efefed",
                  background: filter === tab.key ? "#f5f4ff" : "#fff",
                  color: filter === tab.key ? "#5b53d8" : "#aaa",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: "6px", fontSize: "10px",
                  background: filter === tab.key ? "#eeeeff" : "#f5f5f5",
                  color: filter === tab.key ? "#5b53d8" : "#bbb",
                  padding: "1px 6px", borderRadius: "10px",
                }}>
                  {counts[tab.key as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>

          <div style={revealStyle(0.1)}>
            {filteredLeads.length === 0 ? (
              <div style={{
                background: "#fff", border: "1px solid #efefed",
                borderRadius: "10px", padding: "40px", textAlign: "center",
              }}>
                <p style={{ fontSize: "13px", color: "#bbb" }}>Keine Leads in dieser Kategorie.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {filteredLeads.map((lead) => {
                  const tagStyle = leadTypColor(lead.type);
                  const statStyle = statusStyle(lead.status);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                      style={{
                        background: "#fff", border: "1px solid #efefed",
                        borderRadius: "9px", padding: "13px 16px",
                        display: "flex", alignItems: "center", gap: "12px",
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
                      <div style={{
                        width: "3px", height: "40px", borderRadius: "2px",
                        background: tagStyle.bar, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#0a0a0a" }}>
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
                          fontSize: "12px", color: "#aaa",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          maxWidth: "400px",
                        }}>
                          {lead.message}
                        </p>
                        <div style={{ display: "flex", gap: "10px", marginTop: "3px" }}>
                          {lead.email && <span style={{ fontSize: "11px", color: "#bbb" }}>✉ {lead.email}</span>}
                          {lead.phone && <span style={{ fontSize: "11px", color: "#bbb" }}>✆ {lead.phone}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                        <span style={{ fontSize: "11px", color: "#ccc" }}>{formatDate(lead.created_at)}</span>
                        <span style={{ fontSize: "11px", color: "#bbb" }}>→</span>
                      </div>
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