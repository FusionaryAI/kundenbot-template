import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SESSION_AGE_S, authTimeFromToken, isSessionTooOld } from "./session-age.ts";

const now = 1_800_000_000; // Sekunden
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (payload: unknown) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.signatur`;

test("Anmeldezeit ist der älteste amr-Zeitstempel (spätere MFA-Schritte setzen die Uhr nicht zurück)", () => {
  // Ein Angreifer mit kopiertem Refresh-Token könnte TOTP einrichten und
  // verifizieren; das hängt einen neuen amr-Eintrag mit „jetzt" an.
  const t = token({ amr: [{ method: "totp", timestamp: now - 100 }, { method: "password", timestamp: now - 50_000 }] });
  assert.equal(authTimeFromToken(t), now - 50_000);
});

test("ohne lesbaren amr-Claim: keine Anmeldezeit", () => {
  assert.equal(authTimeFromToken(token({ sub: "u1" })), null);
  assert.equal(authTimeFromToken(token({ amr: "kaputt" })), null);
  assert.equal(authTimeFromToken("kein.jwt"), null);
  assert.equal(authTimeFromToken(""), null);
});

test("Sitzung älter als 12 Stunden gilt als abgelaufen", () => {
  assert.equal(isSessionTooOld(now - MAX_SESSION_AGE_S - 1, now), true);
  assert.equal(isSessionTooOld(now - MAX_SESSION_AGE_S + 60, now), false);
});

test("unbekannte Anmeldezeit sperrt nicht (Claim setzt Supabase selbst)", () => {
  assert.equal(isSessionTooOld(null, now), false);
});
