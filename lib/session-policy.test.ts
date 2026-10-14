import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE_LIMIT_MS, sessionEndReason } from "./session-policy.ts";

const now = 1_800_000_000_000;

test("Browser geschlossen (kein Sitzungs-Cookie) → abmelden", () => {
  assert.equal(sessionEndReason({ hasBrowserMarker: false, lastActivity: now, now }), "browser");
});

test("Aktiv innerhalb der Frist → bleibt angemeldet", () => {
  assert.equal(sessionEndReason({ hasBrowserMarker: true, lastActivity: now - 59 * 60_000, now }), null);
});

test("Länger als 60 Minuten inaktiv → abmelden", () => {
  assert.equal(sessionEndReason({ hasBrowserMarker: true, lastActivity: now - IDLE_LIMIT_MS - 1, now }), "inaktiv");
});

test("Keine bekannte Aktivität → abmelden (z. B. Alt-Sitzung vor Einführung)", () => {
  assert.equal(sessionEndReason({ hasBrowserMarker: true, lastActivity: null, now }), "inaktiv");
});
