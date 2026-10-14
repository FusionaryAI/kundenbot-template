// Verschlüsselt Klartext-Tokens in tenant_integrations.config (Bestand vor der
// Umstellung auf lib/security/secrets.ts). Idempotent: bereits verschlüsselte
// Werte bleiben unverändert — beliebig oft ausführbar.
//
// Voraussetzung: .env.local enthält denselben INTEGRATIONS_ENCRYPTION_KEY wie
// Vercel (sonst kann die App die Werte später nicht entschlüsseln).
// Aufruf: node scripts/encrypt-integration-secrets.ts            (Probelauf)
//         node scripts/encrypt-integration-secrets.ts --write    (schreibt)
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Dynamische Imports erst nach dotenv; Node (strip-types) verlangt die .ts-Endung.
const { supaAdmin } = await import("../lib/db.ts");
const { encryptConfig, isEncrypted, keyFromEnv } = await import("../lib/security/secrets.ts");

// Muss den Feldern mit `secret: true` in lib/integrations/*.ts entsprechen. Die
// Registry selbst lässt sich hier nicht laden (Node braucht Dateiendungen).
const SECRET_FIELDS: Record<string, string[]> = {
  slack: ["webhook_url"],
  hubspot: ["api_key"],
  pipedrive: ["api_key"],
};

const write = process.argv.includes("--write");
const key = keyFromEnv();

const { data: rows, error } = await supaAdmin
  .from("tenant_integrations")
  .select("tenant_id, integration, config");
if (error) throw error;

let pending = 0;
for (const row of rows as Array<{ tenant_id: string; integration: string; config: Record<string, unknown> }>) {
  const fields = SECRET_FIELDS[row.integration] ?? [];
  const plain = fields.filter((f) => typeof row.config?.[f] === "string" && !isEncrypted(row.config[f] as string));
  if (plain.length === 0) continue;

  pending++;
  // Nur Tenant-ID, Integration und Feldnamen ausgeben — nie Werte.
  console.log(`${write ? "verschlüssle" : "offen"}: ${row.tenant_id} / ${row.integration} (${plain.join(", ")})`);
  if (!write) continue;

  const config = encryptConfig(row.config, fields, key, row.tenant_id, row.integration);
  const { error: upErr } = await supaAdmin
    .from("tenant_integrations")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("tenant_id", row.tenant_id)
    .eq("integration", row.integration);
  if (upErr) throw upErr;
}

console.log(
  pending === 0
    ? "Keine Klartext-Tokens gefunden — alles verschlüsselt."
    : write
      ? `${pending} Einträge verschlüsselt.`
      : `${pending} Einträge im Klartext. Mit --write verschlüsseln.`,
);
