import { AuthProvider } from "@/components/app/AuthProvider";
import { AppShell } from "@/components/app/AppShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
