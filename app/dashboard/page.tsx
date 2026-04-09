"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Rolle laden
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!roleData) {
        router.push("/login");
        return;
      }

      setRole(roleData.role);

      // Tenant laden
      let tenantId = roleData.tenant_id;

      // Super Admin sieht ersten Tenant als Übersicht
      if (roleData.role === "super_admin") {
        const { data: firstTenant } = await supabase
          .from("tenants")
          .select("*")
          .limit(1)
          .single();
        if (firstTenant) {
          setTenant(firstTenant);
          tenantId = firstTenant.id;
        }
      } else {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .single();
        if (tenantData) setTenant(tenantData);
      }

      // Leads laden
      if (tenantId) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name, email, phone, message, type, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20);

        setLeads(leadsData ?? []);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

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
    if (t === "appointment") return "bg-blue-500/20 text-blue-300";
    if (t === "callback") return "bg-amber-500/20 text-amber-300";
    return "bg-zinc-500/20 text-zinc-300";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Wird geladen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-white font-semibold">Fusionary AI</span>
          {role === "super_admin" && (
            <span className="ml-2 text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
              Super Admin
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-zinc-400 text-sm hover:text-white transition"
        >
          Abmelden
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tenant Info */}
        {tenant && (
          <div className="mb-8">
            <h1 className="text-xl font-semibold">{tenant.name}</h1>
            <p className="text-zinc-400 text-sm mt-1">Slug: {tenant.slug}</p>
          </div>
        )}

        {/* Leads */}
        <div>
          <h2 className="text-base font-medium mb-4">
            Letzte Leads
            <span className="ml-2 text-zinc-500 text-sm font-normal">
              ({leads.length})
            </span>
          </h2>

          {leads.length === 0 ? (
            <p className="text-zinc-500 text-sm">Noch keine Leads vorhanden.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-zinc-900 border border-white/10 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">
                        {lead.name ?? "Kein Name"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${leadTypColor(lead.type)}`}>
                        {leadTypLabel(lead.type)}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-xs">
                      {formatDate(lead.created_at)}
                    </span>
                  </div>
                  <p className="text-zinc-300 text-sm mb-2 line-clamp-2">{lead.message}</p>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    {lead.email && <span>✉ {lead.email}</span>}
                    {lead.phone && <span>✆ {lead.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}