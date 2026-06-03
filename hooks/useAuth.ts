"use client";

import { useEffect, useState } from "react";
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
  loading: boolean;
};

export function useAuth(): AuthState {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Prefer the tenant explicitly linked in user_roles (works for both
      // regular users and super_admins who pinned a "home" tenant for demos).
      // Fall back to the first tenant only for super_admins without a link.
      if (roleData.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenants").select("id, name, slug, vertical").eq("id", roleData.tenant_id).single();
        if (tenantData) setTenant(tenantData);
      } else if (roleData.role === "super_admin") {
        const { data: firstTenant } = await supabase
          .from("tenants").select("id, name, slug, vertical").limit(1).single();
        if (firstTenant) setTenant(firstTenant);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  return { tenant, role, loading };
}
