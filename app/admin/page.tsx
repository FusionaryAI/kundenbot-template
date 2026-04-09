"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type LeadCount = {
  tenant_id: string;
  count: number;
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

      // Lead-Anzahl pro Tenant laden
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
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">Fusionary AI</span>
          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
            Super Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            Dashboard
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            Abmelden
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold">Alle Kunden</h1>
            <p className="text-zinc-400 text-sm mt-1">
              {tenants.length} {tenants.length === 1 ? "Kunde" : "Kunden"} aktiv
            </p>
          </div>
        </div>

        {tenants.length === 0 ? (
          <p className="text-zinc-500 text-sm">Noch keine Tenants vorhanden.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                onClick={() => router.push(`/admin/${tenant.slug}`)}
                className="bg-zinc-900 border border-white/10 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:border-white/20 transition"
              >
                <div>
                  <p className="text-white font-medium">{tenant.name}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    Slug: {tenant.slug} · Seit {formatDate(tenant.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-white font-medium text-sm">
                      {leadCounts[tenant.id] ?? 0}
                    </p>
                    <p className="text-zinc-500 text-xs">Leads</p>
                  </div>
                  <span className="text-zinc-600">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}