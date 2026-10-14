/**
 * Sitzungsregel fürs Dashboard (Entscheidung Noah, 14.10.2026):
 * abgemeldet, wenn der Browser geschlossen wurde, und nach 60 Minuten ohne
 * Aktivität. Reine Logik ohne Browser-APIs, damit sie testbar bleibt.
 */
export const IDLE_LIMIT_MS = 60 * 60 * 1000;

export type SessionEndReason = "browser" | "inaktiv";

export function sessionEndReason(state: {
  /** Sitzungs-Cookie vorhanden? Verfällt beim Schließen des Browsers. */
  hasBrowserMarker: boolean;
  /** Letzte Aktivität (ms seit Epoch) über alle Tabs, null = unbekannt. */
  lastActivity: number | null;
  now: number;
  idleLimitMs?: number;
}): SessionEndReason | null {
  if (!state.hasBrowserMarker) return "browser";
  const limit = state.idleLimitMs ?? IDLE_LIMIT_MS;
  if (state.lastActivity === null || state.now - state.lastActivity > limit) return "inaktiv";
  return null;
}
