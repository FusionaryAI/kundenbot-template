"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveVertical } from "@/lib/verticals/registry";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

export type AdminTenant = { id: string; name: string; slug: string; vertical: string | null };

/** Lädt den Mandanten zur Kennung; null = nicht gefunden. */
export function useTenantBySlug(slug: string) {
  const [tenant, setTenant] = useState<AdminTenant | null | undefined>(undefined);
  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, name, slug, vertical")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => setTenant((data as AdminTenant) ?? null));
  }, [slug]);
  return tenant;
}

/** Kopf und Unternavigation für alle Admin-Seiten eines Kunden. */
export function AdminTenantFrame({ slug, children }: { slug: string; children: (tenant: AdminTenant) => ReactNode }) {
  const tenant = useTenantBySlug(slug);
  const pathname = usePathname();
  const base = `/admin/${slug}`;
  const tabs = [
    { href: base, label: "Einstellungen" },
    { href: `${base}/knowledge`, label: "Wissen" },
    { href: `${base}/integrations`, label: "Integrationen" },
  ];

  const back = (
    <Link href="/admin" className="inline-flex items-center gap-1.5 self-start text-[0.8125rem] text-ink2 hover:text-ink">
      <ArrowLeft size={14} aria-hidden /> Alle Kunden
    </Link>
  );

  if (tenant === undefined) return <div className="flex flex-col gap-6">{back}<LoadingRows rows={6} /></div>;
  if (tenant === null)
    return (
      <div className="flex flex-col gap-6">
        {back}
        <EmptyState title="Kunde nicht gefunden">Die Kennung „{slug}“ existiert nicht.</EmptyState>
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      {back}
      <div>
        <PageHeader
          eyebrow={`${resolveVertical(tenant).label} · ${tenant.slug}`}
          title={tenant.name}
          actions={
            <ButtonLink href={`/demo/${tenant.slug}`} target="_blank" variant="secondary" size="sm">
              Assistent testen <ArrowUpRight size={14} aria-hidden />
            </ButtonLink>
          }
        />
        <nav aria-label="Kundenbereiche" className="-mt-px flex gap-6 border-b">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 py-3 text-sm transition-colors duration-150",
                  active ? "border-accent font-medium text-ink" : "border-transparent text-ink2 hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children(tenant)}
    </div>
  );
}
