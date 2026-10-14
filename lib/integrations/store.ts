import { supaAdmin } from "@/lib/db";
import { decryptConfig, encryptConfig, keyFromEnv } from "@/lib/security/secrets";
import { getIntegration } from "./registry";
import type { IntegrationAdapter } from "./types";

// Einziger Zugang zu tenant_integrations.config. Geheime Felder (ConfigField.secret)
// liegen in der DB nur verschlüsselt (lib/security/secrets.ts); Klartext existiert
// ausschließlich im Speicher der Server-Funktion.

export type StoredIntegration = {
  adapter: IntegrationAdapter;
  config: Record<string, unknown>;
};

export function secretFieldKeys(adapter: IntegrationAdapter): string[] {
  return adapter.fields.filter((f) => f.secret).map((f) => f.key);
}

/** Lädt die aktiven Integrationen eines Tenants mit entschlüsselter Config. */
export async function loadIntegrations(
  tenantId: string,
  onlyIds?: string[],
): Promise<StoredIntegration[]> {
  let query = supaAdmin
    .from("tenant_integrations")
    .select("integration, config")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  if (onlyIds) query = query.in("integration", onlyIds);

  const { data, error } = await query;
  if (error) {
    console.error("[integrations] laden fehlgeschlagen:", error.message);
    return [];
  }

  const out: StoredIntegration[] = [];
  for (const row of data ?? []) {
    const adapter = getIntegration(row.integration as string);
    if (!adapter) continue;
    const secrets = secretFieldKeys(adapter);
    const raw = (row.config ?? {}) as Record<string, unknown>;
    try {
      const { config, legacyPlaintext } = secrets.length
        ? decryptConfig(raw, secrets, keyFromEnv(), tenantId, adapter.id)
        : { config: raw, legacyPlaintext: [] };
      if (legacyPlaintext.length) {
        // Nur Feldnamen loggen, nie Werte.
        console.warn(
          `[integrations] ${adapter.id}: Klartext-Altbestand (${legacyPlaintext.join(", ")}) — scripts/encrypt-integration-secrets.ts ausführen`,
        );
      }
      out.push({ adapter, config });
    } catch (e) {
      // Fehlender/falscher Schlüssel oder manipuliertes Chiffrat: Integration
      // auslassen statt den Lead-Flow abbrechen.
      console.error(`[integrations] ${adapter.id}: Entschlüsselung fehlgeschlagen:`, (e as Error).message);
    }
  }
  return out;
}

/** Speichert eine validierte Config; geheime Felder werden vorher verschlüsselt. */
export async function saveIntegration(
  tenantId: string,
  adapter: IntegrationAdapter,
  config: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const secrets = secretFieldKeys(adapter);
  const stored = secrets.length
    ? encryptConfig(config, secrets, keyFromEnv(), tenantId, adapter.id)
    : config;

  const { error } = await supaAdmin.from("tenant_integrations").upsert(
    {
      tenant_id: tenantId,
      integration: adapter.id,
      enabled: true,
      config: stored,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,integration" },
  );
  return { error: error?.message ?? null };
}
