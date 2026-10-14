import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_NOTICE, withAiNotice } from "./ai-notice.ts";

test("Ohne Kundentext: Hinweis plus Standardbegrüßung", () => {
  assert.equal(withAiNotice(null), `${AI_NOTICE} Wie kann ich Ihnen helfen?`);
  assert.equal(withAiNotice("   "), `${AI_NOTICE} Wie kann ich Ihnen helfen?`);
});

test("Kundentext wird nie ohne Hinweis ausgegeben", () => {
  assert.equal(withAiNotice("Willkommen in der Praxis!"), `${AI_NOTICE} Willkommen in der Praxis!`);
});

test("Kundentext, der KI/Bot erwähnt, hebelt den Hinweis nicht aus", () => {
  for (const t of ["Kein Bot, echte Beratung!", "Ich bin Ihr KI-Helfer.", "AI chat"]) {
    assert.ok(withAiNotice(t).startsWith(AI_NOTICE), t);
  }
});

test("Doppelte Anwendung stellt den Hinweis nicht zweimal voran", () => {
  const once = withAiNotice("Hallo!");
  assert.equal(withAiNotice(once), once);
});
