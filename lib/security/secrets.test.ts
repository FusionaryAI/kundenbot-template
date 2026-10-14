import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptConfig,
  decryptSecret,
  encryptConfig,
  encryptSecret,
  isEncrypted,
  keyFromEnv,
} from "./secrets.ts";

const key = randomBytes(32);
const AAD = "tenant-a/hubspot/api_key";

test("Roundtrip: verschlüsselt und entschlüsselt denselben Wert", () => {
  const enc = encryptSecret("pat-eu1-geheim", key, AAD);
  assert.ok(isEncrypted(enc));
  assert.ok(!enc.includes("pat-eu1-geheim"));
  assert.equal(decryptSecret(enc, key, AAD), "pat-eu1-geheim");
});

test("Gleicher Klartext ergibt unterschiedliche Chiffrate (zufälliger IV)", () => {
  assert.notEqual(encryptSecret("x", key, AAD), encryptSecret("x", key, AAD));
});

test("Falscher Schlüssel schlägt fehl", () => {
  const enc = encryptSecret("geheim", key, AAD);
  assert.throws(() => decryptSecret(enc, randomBytes(32), AAD));
});

test("In anderen Tenant kopiertes Chiffrat schlägt fehl (AAD-Bindung)", () => {
  const enc = encryptSecret("geheim", key, AAD);
  assert.throws(() => decryptSecret(enc, key, "tenant-b/hubspot/api_key"));
});

test("Manipuliertes Chiffrat schlägt fehl", () => {
  const enc = encryptSecret("geheim", key, AAD);
  const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
  assert.throws(() => decryptSecret(tampered, key, AAD));
});

test("keyFromEnv verlangt genau 32 Byte", () => {
  assert.throws(() => keyFromEnv(undefined), /fehlt/);
  assert.throws(() => keyFromEnv(randomBytes(16).toString("base64")), /32 Byte/);
  assert.equal(keyFromEnv(key.toString("base64")).length, 32);
});

test("encryptConfig verschlüsselt nur geheime Felder und ist idempotent", () => {
  const cfg = { api_key: "pat-123", label: "sichtbar" };
  const once = encryptConfig(cfg, ["api_key"], key, "t1", "hubspot");
  assert.ok(isEncrypted(once.api_key as string));
  assert.equal(once.label, "sichtbar");
  const twice = encryptConfig(once, ["api_key"], key, "t1", "hubspot");
  assert.equal(twice.api_key, once.api_key);
});

test("decryptConfig stellt Klartext her und meldet Altbestände im Klartext", () => {
  const enc = encryptConfig({ api_key: "pat-123" }, ["api_key"], key, "t1", "hubspot");
  const r = decryptConfig(enc, ["api_key"], key, "t1", "hubspot");
  assert.deepEqual(r, { config: { api_key: "pat-123" }, legacyPlaintext: [] });

  const legacy = decryptConfig({ api_key: "alt" }, ["api_key"], key, "t1", "hubspot");
  assert.deepEqual(legacy.legacyPlaintext, ["api_key"]);
});
