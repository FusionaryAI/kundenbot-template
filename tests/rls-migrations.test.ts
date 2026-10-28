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
  for (const policy of ["tenants_select", "user_roles_select", "tenant_settings_rw", "leads_rw", "knowledge_items_rw", "embeddings_rw"]) {
    assert.ok(new RegExp(`create policy ${policy}\\b`).test(sql), `Policy fehlt: ${policy}`);
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
