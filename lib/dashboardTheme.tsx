/**
 * Helles Glassmorphism-Theme für das Fusionary-Dashboard.
 * Machart: feines Gitternetz im Hintergrund, Glas-Panels, Fusionary-Grün als
 * gezielter Akzent (Toggle/Button/Progress/Badge) — neutrale Glas-Kacheln sonst.
 *
 * Geltungsbereich: NUR die App/Produkt-Oberfläche unter /dashboard.
 * Die Marketing-Website bleibt im Light-Branding (siehe CLAUDE.md).
 *
 * Ein Ort für alle Farben, Glas-Stile und den Hintergrund.
 */

import type { CSSProperties, ReactNode } from "react";

// ---- Farb-Tokens ----
export const t = {
  // Flächen
  bg: "#eef1ec",
  text: "#0f1712",
  textSecondary: "rgba(18,30,22,0.64)",
  textMuted: "rgba(18,30,22,0.46)",
  textFaint: "rgba(18,30,22,0.34)",
  border: "rgba(20,45,30,0.10)",
  borderStrong: "rgba(20,45,30,0.18)",

  // Fusionary-Grün (Marken-Identität)
  green: "#1a5c3a",
  greenAccent: "#1a7a47", // lesbarer Akzent auf hell (Text/Linien/aktive Zustände)
  greenSoft: "rgba(26,92,58,0.10)",
  greenBorder: "rgba(26,92,58,0.24)",
  greenGlow: "0 10px 28px -8px rgba(46,196,110,0.5)",

  // Amber (Rückruf / Warnung)
  amber: "#92600e",
  amberSoft: "rgba(146,96,14,0.12)",
  amberBorder: "rgba(146,96,14,0.26)",

  // Rot (Löschen)
  danger: "#c0392b",
} as const;

// ---- Glas-Flächen ----
export const glass: CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(22px) saturate(160%)",
  WebkitBackdropFilter: "blur(22px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 1px 2px rgba(20,45,30,0.04), 0 18px 40px -22px rgba(20,45,30,0.18)",
};

export const glassStrong: CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(22px) saturate(160%)",
  WebkitBackdropFilter: "blur(22px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.85)",
  boxShadow: "0 1px 2px rgba(20,45,30,0.05), 0 20px 44px -22px rgba(20,45,30,0.22)",
};

// ---- Primärer CTA (grün, glühend — wie im Referenz-Screenshot) ----
export const ctaPrimary: CSSProperties = {
  background: "linear-gradient(135deg, #34c46e, #1f9d52)",
  color: "#ffffff",
  border: "1px solid rgba(31,157,82,0.5)",
  boxShadow: t.greenGlow,
  fontWeight: 600,
  cursor: "pointer",
  transition: "filter 0.15s, transform 0.15s, box-shadow 0.15s",
};

// ---- Eingabefelder ----
export const inputDark: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.6)",
  color: t.text,
  borderRadius: "9px",
  padding: "9px 12px",
  fontSize: "13px",
  border: `1px solid ${t.border}`,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s, background 0.15s",
  fontFamily: "inherit",
};

// Theme-Objekt für IntegrationsEditor (helle Glas-Variante)
export const editorTheme = {
  inputBg: "rgba(255,255,255,0.6)",
  border: t.border,
  focus: t.greenBorder,
  surface: "rgba(255,255,255,0.55)",
  text: t.text,
  textMuted: t.textMuted,
  inputText: t.text,
  activeBg: t.greenSoft,
  activeColor: t.greenAccent,
  saveBg: "linear-gradient(135deg, #34c46e, #1f9d52)",
  saveColor: "#ffffff",
  saveHover: "linear-gradient(135deg, #3ad177, #23a958)",
  errorColor: t.danger,
  okColor: t.greenAccent,
};

// ---- Topbar (Seitenkopf) ----
export const topbar: CSSProperties = {
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(18px) saturate(160%)",
  WebkitBackdropFilter: "blur(18px) saturate(160%)",
  borderBottom: `1px solid ${t.border}`,
};

// ---- Lead-/Status-Farben (hell) ----
export function leadTypeStyle(type: string) {
  if (type === "appointment") return { label: "Termin", bg: t.greenSoft, color: t.greenAccent, bar: t.greenAccent };
  if (type === "callback") return { label: "Rückruf", bg: t.amberSoft, color: t.amber, bar: t.amber };
  return { label: "Kontakt", bg: "rgba(18,30,22,0.06)", color: t.textSecondary, bar: "rgba(18,30,22,0.20)" };
}

export function statusStyleDark(s: string) {
  if (s === "in_bearbeitung") return { label: "In Bearbeitung", bg: t.amberSoft, color: t.amber };
  if (s === "erledigt") return { label: "Erledigt", bg: t.greenSoft, color: t.greenAccent };
  return { label: "Neu", bg: "rgba(18,30,22,0.06)", color: t.textSecondary };
}

/**
 * Heller Hintergrund mit feinem Gitternetz + zarten grünen Ambient-Glows —
 * gibt den Glas-Flächen etwas zum Brechen. Machart wie der Referenz-Screenshot,
 * nur invertiert auf hell. Fixed hinter dem gesamten Dashboard.
 */
export function DashboardBackground() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", background: t.bg }}>
      {/* Grund-Verlauf */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #f1f4ee 0%, #eaeee7 50%, #eef2ea 100%)" }} />
      {/* grüne Ambient-Glows */}
      <div style={{ position: "absolute", top: "-16%", left: "8%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(46,196,110,0.14), transparent 62%)", filter: "blur(44px)" }} />
      <div style={{ position: "absolute", bottom: "-24%", right: "-6%", width: "52vw", height: "52vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(26,92,58,0.10), transparent 64%)", filter: "blur(48px)" }} />
      <div style={{ position: "absolute", top: "30%", right: "24%", width: "30vw", height: "30vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(46,196,110,0.08), transparent 62%)", filter: "blur(44px)" }} />
      {/* feines Gitternetz */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(20,50,32,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(20,50,32,0.05) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
        maskImage: "radial-gradient(ellipse 90% 75% at 50% 30%, #000 35%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 30%, #000 35%, transparent 100%)",
      }} />
    </div>
  );
}

/**
 * Standard-Seitenrahmen: heller Hintergrund + Sidebar-Slot + Content-Spalte.
 * Inhalt liegt über dem fixierten Hintergrund (zIndex).
 */
export function DashboardShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", color: t.text, position: "relative", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
      <DashboardBackground />
      <div style={{ position: "relative", zIndex: 1, display: "flex", width: "100%", minHeight: "100vh" }}>
        {sidebar}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
