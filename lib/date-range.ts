const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;

// Obergrenze für den Zeitraum im Wirkung-Dashboard. Die Route legt pro Tag
// einen Eintrag an; ohne Grenze reichte eine einzige Anfrage mit extremen
// Datumswerten (±100 Mio. Tage), um die Funktion per Speicherüberlauf abzuschießen.
export const MAX_RANGE_DAYS = 366;

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export function parseDateRange(fromParam: string | null, toParam: string | null, now: Date): { from: Date; to: Date } {
  const to = parseDate(toParam, now);
  let from = parseDate(fromParam, new Date(to.getTime() - DEFAULT_DAYS * DAY_MS));
  if (from > to) from = new Date(to.getTime() - DEFAULT_DAYS * DAY_MS);
  const earliest = to.getTime() - MAX_RANGE_DAYS * DAY_MS;
  if (from.getTime() < earliest) from = new Date(earliest);
  return { from, to };
}
