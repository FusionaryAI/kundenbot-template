import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Prüft den Authorization-Header eines Cron-Aufrufs (Vercel Cron sendet
 * "Bearer <CRON_SECRET>").
 *
 * Fail-closed: Ohne gesetztes Secret wird jeder Aufruf abgelehnt. Vorher lief
 * die Route ohne Secret ungeschützt und gab allen Anonymen die Mandantenliste
 * zurück. Vergleich über Hashes gleicher Länge mit timingSafeEqual, damit die
 * Antwortzeit nichts über den Wert verrät.
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
