import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { slackAdapter } from "./slack.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Fängt den Webhook-Body ab, statt Slack aufzurufen (kein Netz). */
function captureBody(): { body: string } {
  const captured = { body: "" };
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    captured.body = String(init?.body ?? "");
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  return captured;
}

const config = { webhook_url: "https://hooks.slack.com/services/T0/B0/dummy" };

test("Besucherwerte können keine Slack-Steuer-Syntax einschleusen", async () => {
  const captured = captureBody();
  await slackAdapter.onLead!(
    {
      tenant_id: "t1",
      name: "<!channel>",
      email: "<@U000DUMMY>",
      phone: null,
      message: "<https://angreifer.example.test|HubSpot öffnen> & mehr",
      type: "contact",
      appointment_topic: "<!here>",
      appointment_window: null,
    },
    config,
  );
  const text = JSON.stringify(JSON.parse(captured.body));
  assert.ok(!text.includes("<!channel>"), "Sondererwähnung unmaskiert");
  assert.ok(!text.includes("<!here>"), "Sondererwähnung im Terminthema unmaskiert");
  assert.ok(!text.includes("<@U000DUMMY>"), "Personen-Erwähnung unmaskiert");
  assert.ok(!text.includes("<https://angreifer"), "getarnter Link unmaskiert");
  assert.ok(text.includes("&lt;!channel&gt;"));
  assert.ok(text.includes("&amp; mehr"));
});
