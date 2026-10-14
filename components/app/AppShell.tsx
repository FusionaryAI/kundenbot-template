"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Building2,
  Inbox,
  LayoutList,
  LifeBuoy,
  LogOut,
  Menu,
  Plus,
  Settings2,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearBrowserSession } from "@/lib/session-guard";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "./AuthProvider";

type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean; count?: number };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-full px-3 text-sm transition-colors duration-150",
        active ? "bg-accent-soft font-medium text-accent" : "text-ink2 hover:bg-ink/[0.04] hover:text-ink",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {!!item.count && (
        <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[0.6875rem] font-medium leading-5 text-paper tabular-nums">
          {item.count}
        </span>
      )}
    </Link>
  );
}

function NavGroup({ label, items, pathname, onNavigate }: { label: string; items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="eyebrow mb-2 px-3">{label}</p>
      {items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

/**
 * Rahmen für Dashboard und Admin: Seitenleiste mit Navigation, mobil als
 * einblendbare Leiste. Keine Glas-/Blur-Effekte — Gliederung über Haarlinie.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant, role, email } = useAuth();
  const [open, setOpen] = useState(false);
  const [newLeads, setNewLeads] = useState(0);
  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    if (!tenant) return;
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "neu")
      .then(({ count }) => setNewLeads(count ?? 0));
  }, [tenant, pathname]);

  async function logout() {
    await supabase.auth.signOut();
    clearBrowserSession();
    router.replace("/login");
  }

  const bot: NavItem[] = [
    { label: "Übersicht", href: "/dashboard", icon: LayoutList, exact: true },
    { label: "Anfragen", href: "/dashboard/leads", icon: Inbox, count: newLeads },
    { label: "Wissen", href: "/dashboard/knowledge", icon: BookOpen },
    { label: "Wirkung", href: "/dashboard/wirkung", icon: TrendingUp },
    { label: "Einstellungen", href: "/dashboard/settings", icon: Settings2 },
  ];
  const admin: NavItem[] = [
    { label: "Alle Kunden", href: "/admin", icon: Building2, exact: true },
    { label: "Kunde anlegen", href: "/admin/new", icon: Plus },
  ];

  const nav = (onNavigate?: () => void) => (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-7">
      <NavGroup label={tenant?.name ?? "Ihr Assistent"} items={bot} pathname={pathname} onNavigate={onNavigate} />
      {isSuperAdmin && <NavGroup label="Fusionary" items={admin} pathname={pathname} onNavigate={onNavigate} />}
    </nav>
  );

  const footer = (
    <div className="flex flex-col gap-0.5 border-t pt-4">
      {email && <p className="truncate px-3 pb-2 text-xs text-ink3" title={email}>{email}</p>}
      <a
        href="mailto:info@fusionaryai.de"
        className="flex h-9 items-center gap-3 rounded-full px-3 text-sm text-ink2 hover:bg-ink/[0.04] hover:text-ink"
      >
        <LifeBuoy size={16} strokeWidth={1.75} aria-hidden /> Hilfe anfragen
      </a>
      <button
        type="button"
        onClick={logout}
        className="flex h-9 items-center gap-3 rounded-full px-3 text-left text-sm text-ink2 hover:bg-ink/[0.04] hover:text-ink"
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden /> Abmelden
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {/* Desktop-Seitenleiste */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r bg-paper px-3 py-6 lg:flex">
        <div className="flex flex-col gap-8">
          <Link href="/dashboard" className="px-3" aria-label="Zur Übersicht">
            <Logo />
          </Link>
          {nav()}
        </div>
        {footer}
      </aside>

      {/* Mobile Kopfleiste */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-paper px-4 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menü öffnen"
          aria-expanded={open}
          className="inline-flex size-10 items-center justify-center rounded-full text-ink2 hover:bg-ink/[0.05]"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Menü schließen" className="absolute inset-0 bg-ink/20" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between bg-paper px-3 py-5 shadow-[0_0_0_1px_var(--color-line)]">
            <div className="flex flex-col gap-7">
              <div className="flex items-center justify-between px-3">
                <Logo />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Menü schließen"
                  className="inline-flex size-9 items-center justify-center rounded-full text-ink2 hover:bg-ink/[0.05]"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
              {nav(() => setOpen(false))}
            </div>
            {footer}
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[72rem] px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pt-12">{children}</div>
      </main>
    </div>
  );
}
