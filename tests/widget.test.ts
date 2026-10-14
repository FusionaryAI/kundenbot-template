import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

// Prüft public/widget.js in einer simulierten Kundenseite: Vor dem Klick darf
// kein iframe (und damit keine Verbindung zum Chat-Server) entstehen.
const widgetSource = readFileSync(new URL("../public/widget.js", import.meta.url), "utf8");

function customerPage() {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>
      <script data-slug="praxis-demo" data-origin="https://bot.example/">${widgetSource}</script>
    </body></html>`,
    { runScripts: "dangerously", url: "https://kunde.example/" },
  );
  const doc = dom.window.document;
  return { doc, button: doc.querySelector<HTMLButtonElement>(".pa-btn")! };
}

test("Bubble ist sofort da und weist den KI-Charakter barrierefrei aus", () => {
  const { button } = customerPage();
  assert.ok(button);
  assert.equal(button.getAttribute("aria-label"), "Chat mit KI-Assistent öffnen");
  assert.equal(button.getAttribute("aria-expanded"), "false");
});

test("Vor dem Klick wird kein iframe geladen", () => {
  const { doc } = customerPage();
  assert.equal(doc.querySelectorAll("iframe").length, 0);
});

test("Klick lädt das Chat-Fenster genau einmal und schaltet es um", () => {
  const { doc, button } = customerPage();

  button.click();
  const frames = doc.querySelectorAll("iframe");
  assert.equal(frames.length, 1);
  assert.equal(frames[0].getAttribute("src"), "https://bot.example/embed/praxis-demo");
  assert.equal(frames[0].style.display, "block");
  assert.equal(button.getAttribute("aria-expanded"), "true");

  button.click();
  assert.equal(frames[0].style.display, "none");
  assert.equal(button.getAttribute("aria-expanded"), "false");

  button.click();
  assert.equal(doc.querySelectorAll("iframe").length, 1, "kein zweites iframe");
});
