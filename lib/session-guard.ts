"use client";

import { authTimeFromToken } from "@/lib/session-age";
import { sessionEndReason, type SessionEndReason } from "@/lib/session-policy";

// Browser-Seite der Sitzungsregel (lib/session-policy.ts).
// - Sitzungs-Cookie ohne Ablaufdatum: gilt in allen Tabs, verfällt beim
//   Schließen des Browsers. Enthält nur „1", kein Token.
// - Letzte Aktivität in localStorage: von allen Tabs geteilt, damit Arbeit in
//   einem Tab die anderen nicht abmeldet.

const MARKER = "fa_browser_session";
const ACTIVITY_KEY = "fa_last_activity";

function hasMarker(): boolean {
  return document.cookie.split("; ").some((c) => c === `${MARKER}=1`);
}

function readActivity(): number | null {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function touchActivity() {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Ohne Speicher greift nur die Browser-Regel.
  }
}

/** Nach erfolgreicher Anmeldung bzw. Passwort-Reset aufrufen. */
export function startBrowserSession() {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MARKER}=1; Path=/; SameSite=Lax${secure}`;
  touchActivity();
}

export function clearBrowserSession() {
  document.cookie = `${MARKER}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // ignorieren
  }
}

/** accessToken: aktueller Supabase-Access-Token, für die Obergrenze ab Anmeldung. */
export function currentEndReason(accessToken?: string | null): SessionEndReason | null {
  return sessionEndReason({
    hasBrowserMarker: hasMarker(),
    lastActivity: readActivity(),
    now: Date.now(),
    authTimeSec: accessToken ? authTimeFromToken(accessToken) : null,
  });
}
