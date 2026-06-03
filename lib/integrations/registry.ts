import type { IntegrationAdapter } from "./types";
import { slackAdapter } from "./slack";
import { hubspotAdapter } from "./hubspot";
import { pipedriveAdapter } from "./pipedrive";
import { doctolibAdapter } from "./doctolib";

// Zentrale Registry aller Integrationen. Neue Anbindung = neues Modul + ein
// Eintrag hier. notify/route.ts und der Chat-Handler kennen nur diese Registry.
const ADAPTERS: IntegrationAdapter[] = [
  slackAdapter as IntegrationAdapter,
  hubspotAdapter as IntegrationAdapter,
  pipedriveAdapter as IntegrationAdapter,
  doctolibAdapter as IntegrationAdapter,
];

const BY_ID: Record<string, IntegrationAdapter> = Object.fromEntries(
  ADAPTERS.map((a) => [a.id, a]),
);

export function listIntegrations(): IntegrationAdapter[] {
  return ADAPTERS;
}

export function getIntegration(id: string): IntegrationAdapter | null {
  return BY_ID[(id || "").trim().toLowerCase()] ?? null;
}

/** Integrationen, die ein bestimmtes Vertical anbieten darf. */
export function integrationsForVertical(verticalId: string): IntegrationAdapter[] {
  return ADAPTERS.filter(
    (a) => a.verticals === "all" || a.verticals.includes(verticalId),
  );
}
