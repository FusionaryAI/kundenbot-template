import { test } from "node:test";
import assert from "node:assert/strict";
import { guardrailReply } from "./guardrail-reply.ts";
import { praxisProfile } from "./praxis.ts";

const guard = praxisProfile.adviceGuardrail!;

test("Mit Telefonnummer: Hinweis, Nummer, dann Notfallnummern", () => {
  const text = guardrailReply(guard, { phone: "09499 94010" });
  const iSafety = text.indexOf("keine medizinische Beratung");
  const iPhone = text.indexOf("09499 94010");
  const iEmergency = text.indexOf("116 117");
  assert.ok(iSafety >= 0 && iPhone > iSafety && iEmergency > iPhone, text);
  assert.ok(text.includes("112"));
});

test("Telefonzeiten werden mitgenannt, wenn hinterlegt", () => {
  const text = guardrailReply(guard, { phone: "09499 94010", hours: "Mo–Fr 9–11:30 Uhr" });
  assert.ok(text.includes("**09499 94010** (Mo–Fr 9–11:30 Uhr)"), text);
});

test("Ohne Kontaktdaten keine leere Zeile, Notfallhinweis bleibt", () => {
  for (const contact of [{}, { phone: null }, { phone: "   " }]) {
    const text = guardrailReply(guard, contact);
    assert.ok(!text.includes("Telefonisch"), text);
    assert.ok(text.includes("116 117"), text);
    assert.ok(!text.includes("\n\n\n"), text);
  }
});

test("Profil ohne Notfallhinweis liefert nur den Safety-Text", () => {
  assert.equal(guardrailReply({ safetyFallback: "Hinweis." }, {}), "Hinweis.");
});
