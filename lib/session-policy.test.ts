import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE_LIMIT_MS, sessionEndReason } from "./session-policy.ts";
import { MAX_SESSION_AGE_S } from "./session-age.ts";

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

test("Anmeldung älter als die Obergrenze → abmelden, auch bei Aktivität", () => {
  const authTimeSec = Math.floor(now / 1000) - MAX_SESSION_AGE_S - 1;
  assert.equal(sessionEndReason({ hasBrowserMarker: true, lastActivity: now, now, authTimeSec }), "abgelaufen");
  assert.equal(sessionEndReason({ hasBrowserMarker: true, lastActivity: now, now, authTimeSec: authTimeSec + 120 }), null);
});
