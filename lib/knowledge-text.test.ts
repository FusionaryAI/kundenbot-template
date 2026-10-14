import { test } from "node:test";
import assert from "node:assert/strict";
import { embeddingText } from "./knowledge-text.ts";

test("Mit Titel: Frage steht vor der Antwort", () => {
  assert.equal(embeddingText("Kann ich parken?", "Ja, drei Plätze."), "Kann ich parken?\nJa, drei Plätze.");
});

test("Ohne oder mit leerem Titel: nur der Inhalt (wie Website-Import)", () => {
  for (const t of [null, undefined, "", "   "]) assert.equal(embeddingText(t, "Inhalt"), "Inhalt");
});

test("Titel wird getrimmt", () => {
  assert.equal(embeddingText("  Parken  ", "Ja."), "Parken\nJa.");
});
