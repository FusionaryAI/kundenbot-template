"use client";

import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Props = {
  role?: string | null;
  tenantName?: string | null;
};

function FusionaryLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="35" r="22" stroke="white" strokeWidth="5" fill="none"/>
      <circle cx="50" cy="65" r="22" stroke="white" strokeWidth="5" fill="none"/>
      <path
        d="M28 50 C28 50, 38 38, 50 50 C62 62, 72 50, 72 50"
        stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"
      />
      <path
        d="M28 50 C28 50, 38 62, 50 50 C62 38, 72 50, 72 50"
        stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"
      />
    </svg>
  );
}

const navItems = [
  {
    section: "Übersicht",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5"/>
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
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/>
            <path d="M5 7h6M5 9.5h3"/>
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
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
      width: "220px",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      padding: "20px 12px",
      flexShrink: 0,
      minHeight: "100vh",
    }}>
      {/* Logo */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "0 8px 20px",
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        marginBottom: "12px",
      }}>
        <FusionaryLogo />
        <span style={{ fontSize: "14px", fontWeight: 500, color: "#fff" }}>
          Fusionary AI
        </span>
      </div>

      {/* Navigation */}
      {allItems.map((group) => (
        <div key={group.section} style={{ marginBottom: "8px" }}>
          <p style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.25)",
            padding: "8px 10px 4px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            {group.section}
          </p>
          {group.items.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: isActive ? "#AFA9EC" : "rgba(255,255,255,0.5)",
                  background: isActive ? "rgba(127,119,221,0.15)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      ))}

      {/* User */}
      <div style={{
        marginTop: "auto",
        paddingTop: "16px",
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 8px",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#534AB7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 500,
              color: "#CECBF6",
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.8)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "110px",
              }}>
                {tenantName ?? "Konto"}
              </p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                {role === "super_admin" ? "Super Admin" : "Kunde"}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            title="Abmelden"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.3)",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}