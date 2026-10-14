"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  vertical?: string | null;
};

export type AuthState = {
  tenant: Tenant | null;
  role: string | null;
  email: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Lädt Nutzer, Rolle und Mandant einmal pro Bereich (Dashboard bzw. Admin)
 * statt auf jeder Seite neu. Die eigentliche Rechteprüfung passiert weiterhin
 * serverseitig (RLS bzw. requireTenantAccess/requireSuperAdmin) — das hier
 * steuert nur Weiterleitungen und Anzeige.
 */
export function AuthProvider({
  children,
  requireSuperAdmin = false,
}: {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ tenant: null, role: null, email: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!roleData) return router.replace("/login");
      if (requireSuperAdmin && roleData.role !== "super_admin") return router.replace("/dashboard");

      // Verknüpfter Mandant zuerst; Super-Admins ohne Verknüpfung sehen den
      // ersten Mandanten (Demo-Zugang).
      let tenant: Tenant | null = null;
      if (roleData.tenant_id) {
        const { data } = await supabase.from("tenants").select("id, name, slug, vertical").eq("id", roleData.tenant_id).single();
        tenant = data;
      } else if (roleData.role === "super_admin") {
        const { data } = await supabase.from("tenants").select("id, name, slug, vertical").limit(1).single();
        tenant = data;
      }

      if (!cancelled) setState({ tenant, role: roleData.role, email: user.email ?? null, loading: false });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router, requireSuperAdmin]);

  // Bis Anmeldung (und ggf. Admin-Rolle) bestätigt sind, wird nichts aus dem
  // Bereich gerendert — auch nicht der Rahmen. Ohne Anmeldung bleibt es bei
  // diesem Hinweis, bis die Weiterleitung zur Login-Seite greift.
  if (state.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper text-sm text-ink3" aria-busy="true">
        Anmeldung wird geprüft …
      </div>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
