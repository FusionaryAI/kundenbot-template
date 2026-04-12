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
    ? tenantName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div style={{
      width: "210px",
      background: "#fff",
      borderRight: "1px solid #efefed",
      display: "flex",
      flexDirection: "column",
      padding: "18px 10px",
      flexShrink: 0,
      minHeight: "100vh",
    }}>
      <div style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "#111",
        padding: "2px 8px 18px",
        borderBottom: "1px solid #f0f0f0",
        marginBottom: "16px",
        letterSpacing: "-0.2px",
      }}>
        Fusionary AI
      </div>

      {allItems.map((group) => (
        <div key={group.section} style={{ marginBottom: "4px" }}>
          <p style={{
            fontSize: "9px",
            color: "#ccc",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "8px 8px 4px",
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
                  borderRadius: "7px",
                  fontSize: "12.5px",
                  color: isActive ? "#5b53d8" : "#aaa",
                  background: isActive ? "#f5f4ff" : "transparent",
                  fontWeight: isActive ? 500 : 400,
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  transition: "all 0.15s",
                  marginBottom: "2px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#f7f7f5";
                    e.currentTarget.style.color = "#444";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#aaa";
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
        paddingTop: "14px",
        borderTop: "1px solid #f0f0f0",
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
            borderRadius: "8px",
            background: "#eeecff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 700,
            color: "#5b53d8",
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: "11.5px",
              color: "#444",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "120px",
            }}>
              {tenantName ?? "Konto"}
            </p>
            <p style={{ fontSize: "10px", color: "#bbb" }}>
              {role === "super_admin" ? "Super Admin" : "Kunde"}
            </p>
          </div>
        </div>
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
            fontSize: "11.5px",
            color: "#bbb",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#fff0f0";
            e.currentTarget.style.color = "#e05";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#bbb";
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