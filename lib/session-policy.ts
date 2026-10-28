import { isSessionTooOld } from "./session-age.ts";

/**
 * Sitzungsregel fürs Dashboard (Entscheidung Noah, 14.10.2026):
 * abgemeldet, wenn der Browser geschlossen wurde, und nach 60 Minuten ohne
 * Aktivität. Zusätzlich gilt die harte Obergrenze ab Anmeldung, die auch
 * Server und Datenbank durchsetzen (lib/session-age.ts) — hier, damit der
 * Nutzer sauber abgemeldet wird statt leere Listen zu sehen.
 * Reine Logik ohne Browser-APIs, damit sie testbar bleibt.
 */
export const IDLE_LIMIT_MS = 60 * 60 * 1000;

export type SessionEndReason = "browser" | "inaktiv" | "abgelaufen";

export function sessionEndReason(state: {
  /** Sitzungs-Cookie vorhanden? Verfällt beim Schließen des Browsers. */
  hasBrowserMarker: boolean;
  /** Letzte Aktivität (ms seit Epoch) über alle Tabs, null = unbekannt. */
  lastActivity: number | null;
  now: number;
  idleLimitMs?: number;
  /** Anmeldezeit aus dem Access-Token (Unix-Sekunden), null = unbekannt. */
  authTimeSec?: number | null;
}): SessionEndReason | null {
  if (!state.hasBrowserMarker) return "browser";
  if (isSessionTooOld(state.authTimeSec ?? null, Math.floor(state.now / 1000))) return "abgelaufen";
  const limit = state.idleLimitMs ?? IDLE_LIMIT_MS;
  if (state.lastActivity === null || state.now - state.lastActivity > limit) return "inaktiv";
  return null;
}
