// Harte Obergrenze für eine Dashboard-Sitzung, gerechnet ab der Anmeldung.
//
// Hintergrund (Audit NV-8): Die Regel „60 Min. inaktiv / Browser zu" wirkt nur
// im Browser. Supabase kann im Free-Plan keinen Inactivity-Timeout setzen, ein
// kopierter Refresh-Token blieb damit unbegrenzt nutzbar. Supabase schreibt
// den Anmeldezeitpunkt als amr-Claim in jeden Access-Token, auch nach Refresh;
// daran prüfen API (lib/auth-server.ts), Datenbank (session_is_fresh() in den
// Migrationen) und Browser (lib/session-policy.ts) dieselbe Grenze.
//
// Änderung der Grenze: auch den Wert in session_is_fresh() (SQL) mitziehen.
export const MAX_SESSION_AGE_S = 12 * 60 * 60;

function decodePayload(token: string): unknown {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

/**
 * Anmeldezeit (Unix-Sekunden) aus einem bereits verifizierten Access-Token:
 * der älteste amr-Zeitstempel. Jede Anmeldung erzeugt eine neue Sitzung; spätere
 * Einträge (z. B. eine MFA-Verifizierung) dürfen die Uhr nicht zurückstellen.
 * Signatur prüft dieser Helfer nicht — nur nach auth.getUser() bzw. für die
 * Anzeige im Browser verwenden.
 */
export function authTimeFromToken(token: string): number | null {
  const amr = (decodePayload(token) as { amr?: unknown } | null)?.amr;
  if (!Array.isArray(amr)) return null;
  const times = amr.map((m) => Number(m?.timestamp)).filter((t) => Number.isFinite(t) && t > 0);
  return times.length ? Math.min(...times) : null;
}

/**
 * Fehlt die Anmeldezeit, wird nicht gesperrt: Der Claim kommt von Supabase
 * selbst und ist signiert; ihn zu entfernen hieße, den Token zu fälschen.
 */
export function isSessionTooOld(authTimeSec: number | null, nowSec: number, maxAgeSec = MAX_SESSION_AGE_S): boolean {
  return authTimeSec !== null && nowSec - authTimeSec > maxAgeSec;
}
