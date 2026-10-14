import { loadIntegrations } from "./store";
import type { LeadPayload } from "./types";

/**
 * Meldet einen neuen Lead an alle aktiven Integrationen (Slack, HubSpot, Pipedrive).
 *
 * Läuft im selben Server-Prozess wie die Lead-Erfassung — früher ein eigener,
 * öffentlich erreichbarer HTTP-Endpunkt ohne Authentifizierung, über den jeder
 * mit einer tenant_id Nachrichten in die CRMs der Kunden schreiben konnte.
 */
export async function notifyIntegrations(tenantId: string, lead: LeadPayload): Promise<void> {
  const configured = await loadIntegrations(tenantId);

  // Adapter isoliert ausführen — ein Fehler bei einem Anbieter darf die
  // übrigen Benachrichtigungen nicht verhindern.
  for (const { adapter, config } of configured) {
    if (!adapter.onLead) continue;
    try {
      const parsed = adapter.configSchema.safeParse(config);
      if (!parsed.success) {
        console.warn(`[integrations] ${adapter.id}: ungültige Konfiguration`);
        continue;
      }
      await adapter.onLead(lead, parsed.data);
    } catch (e: unknown) {
      console.error(`[integrations] ${adapter.id}:`, e instanceof Error ? e.message : String(e));
    }
  }
}
