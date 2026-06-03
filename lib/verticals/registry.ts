import type { VerticalProfile } from "./types";
import { baseProfile } from "./base";
import { praxisProfile } from "./praxis";

// Zentrale Registry aller Branchen-Profile. Neue Branche = neues Modul + ein
// Eintrag hier. Der Chat-Handler kennt nur resolveVertical(), keine if/else.
const PROFILES: Record<string, VerticalProfile> = {
  [baseProfile.id]: baseProfile,
  [praxisProfile.id]: praxisProfile,
};

// Profile mit detect()-Heuristik, in Prüf-Reihenfolge (base hat keine).
const DETECTABLE: VerticalProfile[] = [praxisProfile];

export function listVerticals(): VerticalProfile[] {
  return Object.values(PROFILES);
}

export function getVertical(id: string): VerticalProfile | null {
  const key = (id || "").trim().toLowerCase();
  return PROFILES[key] ?? null;
}

/**
 * Ermittelt das aktive Profil für einen Tenant.
 *
 * 1. Ist tenants.vertical explizit auf eine bekannte Branche gesetzt → diese.
 * 2. Sonst (Spalte leer/unbekannt) → Legacy-Heuristik auf Name + Label,
 *    damit Bestandskunden ohne Backfill exakt das bisherige Verhalten behalten.
 * 3. Fallback: base.
 */
export function resolveVertical(
  tenant: { vertical?: string | null; name?: string | null },
  context?: { tenant_label?: string | null } | null,
): VerticalProfile {
  const explicit = getVertical((tenant?.vertical ?? "").toString());
  if (explicit) return explicit;

  const name = tenant?.name ?? "";
  const label = context?.tenant_label ?? null;
  for (const profile of DETECTABLE) {
    if (profile.detect?.(name, label)) return profile;
  }
  return baseProfile;
}
