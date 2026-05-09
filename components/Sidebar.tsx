"use client";

import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
      width: "220px",
      background: "#fff",
      borderRight: "1px solid #e8e6e0",
      display: "flex",
      flexDirection: "column",
      padding: "16px 10px",
      flexShrink: 0,
      minHeight: "100vh",
    }}>
      {/* Wordmark */}
      <div style={{
        fontSize: "13px",
        fontWeight: 600,
        color: "#0f0f0e",
        padding: "2px 8px 16px",
        borderBottom: "1px solid #e8e6e0",
        marginBottom: "14px",
        letterSpacing: "0.02em",
        textTransform: "uppercase" as const,
      }}>
        Fusionary AI
      </div>

      {allItems.map((group) => (
        <div key={group.section} style={{ marginBottom: "2px" }}>
          <p style={{
            fontSize: "10px",
            color: "#888780",
            letterSpacing: "0.08em",
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
                  gap: "8px",
                  padding: "7px 9px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: isActive ? "#1a5c3a" : "#4a4a47",
                  background: isActive ? "#e2ede8" : "transparent",
                  fontWeight: isActive ? 500 : 400,
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left" as const,
                  transition: "all 0.15s",
                  marginBottom: "1px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#f1efea";
                    e.currentTarget.style.color = "#0f0f0e";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#4a4a47";
                  }
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      ))}

      <div style={{
        marginTop: "auto",
        paddingTop: "12px",
        borderTop: "1px solid #e8e6e0",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 8px",
          marginBottom: "4px",
        }}>
          <div style={{
            width: "26px",
            height: "26px",
            borderRadius: "7px",
            background: "#e2ede8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 600,
            color: "#1a5c3a",
            flexShrink: 0,
            letterSpacing: "0.03em",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: "12px",
              color: "#0f0f0e",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "120px",
            }}>
              {tenantName ?? "Konto"}
            </p>
            <p style={{ fontSize: "10.5px", color: "#888780" }}>
              {role === "super_admin" ? "Super Admin" : "Kunde"}
            </p>
          </div>
        </div>

        <button
          onClick={() => { window.location.href = supportHref; }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 9px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#888780",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left" as const,
            transition: "all 0.15s",
            marginBottom: "1px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f1efea";
            e.currentTarget.style.color = "#1a5c3a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#888780";
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
            gap: "6px",
            padding: "6px 9px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#888780",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left" as const,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#faeeda";
            e.currentTarget.style.color = "#85500b";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#888780";
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
