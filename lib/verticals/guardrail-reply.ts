import type { AdviceGuardrail } from "./types.ts";

export type TenantContact = {
  phone?: string | null;
  hours?: string | null;
};

/**
 * Antwort, wenn der Branchen-Guardrail greift und kein Handoff angeboten wird:
 * Safety-Hinweis, dann der direkte Kontaktweg des Tenants (sonst bliebe nur
 * „wenden Sie sich an die Praxis" ohne Nummer), zuletzt der Notfallhinweis.
 */
export function guardrailReply(
  guard: Pick<AdviceGuardrail, "safetyFallback" | "emergencyHint">,
  contact: TenantContact,
): string {
  const parts = [guard.safetyFallback];

  const phone = contact.phone?.trim();
  const hours = contact.hours?.trim();
  if (phone) {
    parts.push(
      hours
        ? `Telefonisch erreichbar unter **${phone}** (${hours}).`
        : `Telefonisch erreichbar unter **${phone}**.`,
    );
  }

  if (guard.emergencyHint) parts.push(guard.emergencyHint);
  return parts.join("\n\n");
}
