"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || roleData.role !== "super_admin") {
        router.push("/dashboard");
        return;
      }

      const { data: tenantsData } = await supabase
        .from("tenants")
        .select("id, name, slug, created_at")
        .order("created_at", { ascending: false });

      setTenants(tenantsData ?? []);

      if (tenantsData && tenantsData.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(
          tenantsData.map(async (t) => {
            const { count } = await supabase
              .from("leads")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", t.id);
            counts[t.id] = count ?? 0;
          })
        );
        setLeadCounts(counts);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  }

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
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#111" }}>
              {greeting()}, Admin 👋
            </p>
            <p style={{ fontSize: "12px", color: "#888", marginTop: "3px" }}>
              Hier ist deine Kundenübersicht.
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/new")}
            style={{
              fontSize: "13px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#111",
              color: "#fff",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            + Neuen Kunden anlegen
          </button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Statistik */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "12px" }}>
            {[
              { label: "Kunden gesamt", value: tenants.length, sub: "aktiv" },
              { label: "Leads gesamt", value: Object.values(leadCounts).reduce((a, b) => a + b, 0), sub: "alle Kunden" },
              { label: "Ø Leads pro Kunde", value: tenants.length > 0 ? Math.round(Object.values(leadCounts).reduce((a, b) => a + b, 0) / tenants.length) : 0, sub: "Durchschnitt" },
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

          {/* Kundenliste */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>Alle Kunden</p>
              <span style={{ fontSize: "12px", color: "#888" }}>
                {tenants.length} {tenants.length === 1 ? "Kunde" : "Kunden"}
              </span>
            </div>

            {tenants.length === 0 ? (
              <div style={{
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                padding: "32px",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "13px", color: "#aaa" }}>Noch keine Kunden vorhanden.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    onClick={() => router.push(`/admin/${tenant.slug}`)}
                    style={{
                      background: "#fff",
                      border: "0.5px solid rgba(0,0,0,0.08)",
                      borderRadius: "12px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: "#EEEDFE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#534AB7",
                        flexShrink: 0,
                      }}>
                        {tenant.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>{tenant.name}</p>
                        <p style={{ fontSize: "11px", color: "#aaa", marginTop: "1px" }}>
                          {tenant.slug} · Seit {formatDate(tenant.created_at)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#111" }}>
                          {leadCounts[tenant.id] ?? 0}
                        </p>
                        <p style={{ fontSize: "11px", color: "#aaa" }}>Leads</p>
                      </div>
                      <span style={{ color: "#ccc", fontSize: "16px" }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}