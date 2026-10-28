import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Die Mandantentrennung im Browser-Pfad (PostgREST mit anon-Key + Nutzer-JWT)
// hängt allein an RLS. Sie muss deshalb in jeder Installation per Migration
// ankommen, nicht über ein manuell auszuführendes Skript.
const dir = join(import.meta.dirname, "..", "supabase", "migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n")
  .toLowerCase();

const CORE_TABLES = ["tenants", "tenant_settings", "user_roles", "leads", "knowledge_items", "embeddings"];

test("Migrationen aktivieren RLS auf allen Kerntabellen", () => {
  for (const table of CORE_TABLES) {
    assert.ok(new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(sql), `RLS fehlt: ${table}`);
  }
});

test("Migrationen enthalten die mandantenbindenden Policies", () => {
  const expected: Record<string, string> = {
    tenants: "tenants_select",
    user_roles: "user_roles_select",
    tenant_settings: "tenant_settings_select",
    leads: "leads_rw",
    knowledge_items: "knowledge_items_rw",
    embeddings: "embeddings_rw",
  };
  for (const [table, policy] of Object.entries(expected)) {
    assert.ok(finalPolicies(table).has(policy), `Policy fehlt nach allen Migrationen: ${policy}`);
  }
});

/** Endzustand der Policies einer Tabelle nach allen Migrationen (create/drop in Dateireihenfolge). */
function finalPolicies(table: string): Map<string, string> {
  const policies = new Map<string, string>();
  const stmt = new RegExp(
    `(drop policy if exists (\\w+) on public\\.${table}\\b)|(create policy (\\w+) on public\\.${table}\\b[^;]*;)`,
    "g",
  );
  for (const m of sql.matchAll(stmt)) {
    if (m[2]) policies.delete(m[2]);
    else policies.set(m[4], m[3]);
  }
  return policies;
}

test("tenant_settings: Kunden lesen, nur super_admin schreibt (lead_email, lead_enabled)", () => {
  const policies = [...finalPolicies("tenant_settings").values()];
  assert.ok(policies.some((p) => /for select/.test(p) && /current_tenant_id\(\)/.test(p)), "Lese-Policy für Kunden fehlt");
  for (const p of policies.filter((p) => !/for select/.test(p))) {
    assert.ok(!/current_tenant_id\(\)/.test(p), `Kunde darf schreiben: ${p.slice(0, 80)}`);
    assert.ok(/is_super_admin\(\)/.test(p), "Schreib-Policy ohne super_admin-Bindung");
  }
});

test("keine einzelne Migration gibt Kunden Schreibrechte auf tenant_settings (erneutes Ausführen bleibt sicher)", () => {
  // Die Migrationen werden manuell und teils wiederholt ausgeführt. Eine ältere
  // Datei darf die Einschränkung aus einer neueren deshalb nicht zurückdrehen.
  for (const create of sql.match(/create policy \w+ on public\.tenant_settings\b[^;]*;/g) ?? []) {
    if (/for select/.test(create)) continue;
    assert.ok(!/current_tenant_id\(\)/.test(create), `Schreib-Policy für Kunden: ${create.slice(0, 60)}`);
  }
});

test("user_roles und tenants sind für Browser-Rollen nicht beschreibbar", () => {
  // user_roles ist die einzige Quelle der super_admin-Autorität (lib/auth-server.ts).
  assert.ok(
    /revoke insert, update, delete(, truncate)? on public\.user_roles, public\.tenants from anon, authenticated/.test(sql),
    "REVOKE für user_roles/tenants fehlt",
  );
  assert.ok(!/create policy \w+ on public\.user_roles\s+for (all|insert|update|delete)/.test(sql), "Schreib-Policy auf user_roles");
});
