"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import IntegrationsEditor from "@/components/IntegrationsEditor";
import { resolveVertical } from "@/lib/verticals/registry";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  vertical?: string | null;
};

export default function AdminIntegrationsPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [verticalLabel, setVerticalLabel] = useState("");
  const [verticalId, setVerticalId] = useState("base");
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role !== "super_admin") { router.push("/dashboard"); return; }

      const { data: tenantData } = await supabase
        .from("tenants").select("*").eq("slug", slug).single();

      if (!tenantData) { router.push("/admin"); return; }
      setTenant(tenantData);

      const profile = resolveVertical(tenantData);
      setVerticalLabel(profile.label);
      setVerticalId(profile.id);

      setLoading(false);
      setTimeout(() => setRevealed(true), 50);
    }
    load();
  }, [slug, router]);

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
      <Sidebar role="super_admin" tenantName="Fusionary AI" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <div style={{
          background: "#fff",
          borderBottom: "1px solid #efefed",
          padding: "18px 28px",
          ...revealStyle(0),
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <button
              onClick={() => router.push(`/admin/${slug}`)}
              style={{ background: "none", border: "none", color: "#bbb", fontSize: "12px", cursor: "pointer", padding: 0 }}
            >
              ← {tenant?.name}
            </button>
            <span style={{ color: "#e0e0e0" }}>/</span>
            <span style={{ fontSize: "12px", color: "#999" }}>Integrationen</span>
          </div>
          <p style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "22px",
            fontWeight: 400,
            color: "#0a0a0a",
            letterSpacing: "-0.3px",
          }}>
            Integrationen für{" "}
            <span style={{ fontWeight: 600, fontStyle: "italic", color: "#2d5a1b" }}>
              {tenant?.name}
            </span>
          </p>
          <p style={{ fontSize: "12px", color: "#bbb", marginTop: "4px" }}>
            Verfügbare Integrationen für das Profil{" "}
            <span style={{ color: "#999", fontWeight: 500 }}>{verticalLabel}</span>. Leere Felder
            deaktivieren die Integration.
          </p>
        </div>

        <div style={{ padding: "24px 28px", maxWidth: "640px", ...revealStyle(0.05) }}>
          {tenant && (
            <IntegrationsEditor
              tenantId={tenant.id}
              verticalId={verticalId}
              theme={{ inputBg: "#fafafa", border: "#efefed", focus: "#c8c4f8" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
