import type { BadgeTone } from "@/components/ui/Badge";

export type LeadStatus = "neu" | "in_bearbeitung" | "erledigt";
export type LeadType = "appointment" | "callback" | "contact";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "neu", label: "Neu" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "erledigt", label: "Erledigt" },
];

export function leadStatusLabel(status: string | null | undefined): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? "Neu";
}

export function leadStatusTone(status: string | null | undefined): BadgeTone {
  if (status === "erledigt") return "neutral";
  if (status === "in_bearbeitung") return "warn";
  return "accent";
}

export function leadTypeLabel(type: string | null | undefined): string {
  if (type === "appointment") return "Terminwunsch";
  if (type === "callback") return "Rückruf";
  return "Kontakt";
}

const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

/** „vor 3 Stunden", „gestern" — für Listen; ab 7 Tagen das Datum. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "gerade eben";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Für tel:-Links: nur Ziffern und führendes +. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
