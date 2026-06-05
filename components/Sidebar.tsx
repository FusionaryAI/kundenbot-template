"use client";

import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { t, glass } from "@/lib/dashboardTheme";

type Props = {
  role?: string | null;
  tenantName?: string | null;
};

const navItems = [
  {
    section: "Übersicht",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5"/>
          </svg>
        ),
      },
      {
        label: "Wirkung",
        href: "/dashboard/wirkung",
        badge: "NEU",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 12l4-4 3 3 5-6"/>
            <path d="M11 5h3v3"/>
          </svg>
        ),
      },
      {
        label: "Leads",
        href: "/dashboard/leads",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="6" r="3"/>
            <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: "Bot",
    items: [
      {
        label: "Wissensbasis",
        href: "/dashboard/knowledge",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/>
            <path d="M5 7h6M5 9.5h3"/>
          </svg>
        ),
      },
      {
        label: "Integrationen",
        href: "/dashboard/settings",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="4" cy="4" r="2"/>
            <circle cx="12" cy="4" r="2"/>
            <circle cx="8" cy="12" r="2"/>
            <path d="M4 6v2a4 4 0 008 0V6"/>
          </svg>
        ),
      },
    ],
  },
];

const adminItems = [
  {
    section: "Admin",
    items: [
      {
        label: "Alle Kunden",
        href: "/admin",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="5" r="2.5"/>
            <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4"/>
            <path d="M11 3c1.5 0 3 1 3 3s-1.5 3-3 3"/>
            <path d="M14 13c0-1.5-1-2.5-3-3"/>
          </svg>
        ),
      },
      {
        label: "Neuen Kunden",
        href: "/admin/new",
        icon: (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="6" r="3"/>
            <path d="M1 14c0-3 2.5-5 6-5"/>
            <path d="M12 10v4M10 12h4"/>
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ role, tenantName }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const allItems = role === "super_admin"
    ? [...navItems, ...adminItems]
    : navItems;

  const initials = tenantName
    ? tenantName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const supportHref = `mailto:info@fusionaryai.de?subject=Support-Anfrage von ${tenantName ?? "Kunde"}`;

  return (
    <div style={{
      width: "224px",
      ...glass,
      borderRadius: 0,
      borderTop: "none",
      borderBottom: "none",
      borderLeft: "none",
      display: "flex",
      flexDirection: "column",
      padding: "18px 12px",
      flexShrink: 0,
      minHeight: "100vh",
    }}>
      {/* Wordmark */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "2px 8px 16px",
        borderBottom: `1px solid ${t.border}`,
        marginBottom: "14px",
      }}>
        <div style={{
          width: "22px", height: "22px", borderRadius: "7px",
          background: "linear-gradient(135deg, #41c878, #1f8f4d)",
          boxShadow: t.greenGlow,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: "13px",
          fontWeight: 600,
          color: t.text,
          letterSpacing: "0.04em",
          textTransform: "uppercase" as const,
        }}>
          Fusionary AI
        </span>
      </div>

      {allItems.map((group) => (
        <div key={group.section} style={{ marginBottom: "2px" }}>
          <p style={{
            fontSize: "10px",
            color: t.textMuted,
            letterSpacing: "0.09em",
            textTransform: "uppercase" as const,
            padding: "8px 8px 3px",
            fontWeight: 500,
          }}>
            {group.section}
          </p>
          {group.items.map((item: any) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "8px 10px",
                  borderRadius: "9px",
                  fontSize: "13px",
                  color: isActive ? t.greenAccent : t.textSecondary,
                  background: isActive ? t.greenSoft : "transparent",
                  fontWeight: isActive ? 500 : 400,
                  border: isActive ? `1px solid ${t.greenBorder}` : "1px solid transparent",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left" as const,
                  transition: "all 0.15s",
                  marginBottom: "2px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(18,30,22,0.05)";
                    e.currentTarget.style.color = t.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = t.textSecondary;
                  }
                }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: t.greenAccent,
                      background: t.greenSoft,
                      border: `1px solid ${t.greenBorder}`,
                      padding: "2px 6px",
                      borderRadius: "5px",
                      lineHeight: 1,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div style={{
        marginTop: "auto",
        paddingTop: "12px",
        borderTop: `1px solid ${t.border}`,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "5px 8px",
          marginBottom: "4px",
        }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: t.greenSoft,
            border: `1px solid ${t.greenBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 600,
            color: t.greenAccent,
            flexShrink: 0,
            letterSpacing: "0.03em",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: "12px",
              color: t.text,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "120px",
            }}>
              {tenantName ?? "Konto"}
            </p>
            <p style={{ fontSize: "10.5px", color: t.textMuted }}>
              {role === "super_admin" ? "Super Admin" : "Kunde"}
            </p>
          </div>
        </div>

        <button
          onClick={() => { window.location.href = supportHref; }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "7px 9px",
            borderRadius: "8px",
            fontSize: "12px",
            color: t.textMuted,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left" as const,
            transition: "all 0.15s",
            marginBottom: "1px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(18,30,22,0.05)";
            e.currentTarget.style.color = t.greenAccent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = t.textMuted;
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/>
            <path d="M2 4l6 5 6-5"/>
          </svg>
          Support kontaktieren
        </button>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "7px 9px",
            borderRadius: "8px",
            fontSize: "12px",
            color: t.textMuted,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left" as const,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.amberSoft;
            e.currentTarget.style.color = t.amber;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = t.textMuted;
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/>
          </svg>
          Abmelden
        </button>
      </div>
    </div>
  );
}
