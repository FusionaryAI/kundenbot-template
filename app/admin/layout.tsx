"use client";

import { AuthProvider, useAuth } from "@/components/app/AuthProvider";
import { AppShell } from "@/components/app/AppShell";

/**
 * Zugriffsschutz für den gesamten /admin-Bereich: Inhalte erscheinen erst,
 * wenn feststeht, dass ein super_admin eingeloggt ist (sonst Weiterleitung im
 * AuthProvider). Das ist die UX-Schicht — die Datensicherheit liefern die
 * serverseitigen Prüfungen in den API-Routen und Supabase RLS.
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading || role !== "super_admin") {
    return <p className="py-24 text-center text-sm text-ink3">Zugriff wird geprüft …</p>;
  }
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireSuperAdmin>
      <AppShell>
        <AdminGate>{children}</AdminGate>
      </AppShell>
    </AuthProvider>
  );
}
