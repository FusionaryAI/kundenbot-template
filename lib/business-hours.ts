// Business-hours check in Europe/Berlin, dependency-free.
// Opening hours JSON shape (per tenant):
//   { mo: {open: "08:00", close: "18:00"} | null, di: ..., ..., so: ... }

export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Record<string, DayHours>;

const DAY_KEYS = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;

function getBerlinParts(date: Date): { dayKey: string; minutes: number } {
  // Intl.DateTimeFormat with Europe/Berlin gives us localized weekday + HH:mm.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value || "Sun";
  const hh = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value || "0");

  // en-US weekday abbreviations -> 0..6 (Sun..Sat)
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const idx = map[wd] ?? 0;
  return { dayKey: DAY_KEYS[idx], minutes: hh * 60 + mm };
}

function parseHM(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

const DEFAULT_HOURS: OpeningHours = {
  mo: { open: "08:00", close: "18:00" },
  di: { open: "08:00", close: "18:00" },
  mi: { open: "08:00", close: "18:00" },
  do: { open: "08:00", close: "18:00" },
  fr: { open: "08:00", close: "16:00" },
  sa: null,
  so: null,
};

export function isOutsideBusinessHours(
  timestamp: Date,
  openingHours: OpeningHours | null | undefined
): boolean {
  const hours = openingHours && typeof openingHours === "object" ? openingHours : DEFAULT_HOURS;
  const { dayKey, minutes } = getBerlinParts(timestamp);
  const day = hours[dayKey];
  if (!day) return true; // closed all day

  const open = parseHM(day.open);
  const close = parseHM(day.close);
  if (open === null || close === null) return true; // malformed -> treat as closed

  return minutes < open || minutes >= close;
}
