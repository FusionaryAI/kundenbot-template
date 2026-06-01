"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Zugriffsschutz für den gesamten /admin-Bereich.
 *
 * Rendert die Admin-Seiten erst, wenn der eingeloggte Nutzer ein super_admin
 * ist. Nicht eingeloggt → /login, eingeloggt ohne super_admin → /dashboard.
 *
 * Hinweis: Das ist die UX-Schicht. Die eigentliche Datensicherheit liefern
 * die serverseitigen Auth-Checks in den API-Routen + Supabase Row Level
 * Security (siehe supabase/rls-policies.sql).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!active) return;

      if (roleRow?.role === "super_admin") {
        setState("ok");
      } else {
        router.replace("/dashboard");
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  if (state !== "ok") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "14px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Wird geprüft …
      </div>
    );
  }

  return <>{children}</>;
}
