"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
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

      if (roleData.role === "super_admin") {
        const { data: firstTenant } = await supabase
          .from("tenants").select("id, name, slug").limit(1).single();
        if (firstTenant) setTenant(firstTenant);
      } else {
        const { data: tenantData } = await supabase
          .from("tenants").select("id, name, slug").eq("id", roleData.tenant_id).single();
        if (tenantData) setTenant(tenantData);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  return { tenant, role, loading };
}
