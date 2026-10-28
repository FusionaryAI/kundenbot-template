import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { hubspotAdapter } from "./hubspot.ts";

type Call = { url: string; method: string; body: { properties?: Record<string, string> } | null };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Ersetzt fetch durch eine feste Antwortfolge und zeichnet die Aufrufe auf (kein Netz). */
function stubFetch(responses: Array<{ status: number; json: unknown }>): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    const r = responses.shift() ?? { status: 500, json: {} };
    return new Response(JSON.stringify(r.json), { status: r.status });
  }) as typeof fetch;
  return calls;
}

const config = { api_key: "dummy-token" };
const lead = { tenant_id: "t1", name: null, email: "bestand@example.test", phone: null, message: "Rückruf bitte", type: "contact" };

test("bestehender Kontakt (409) wird nicht überschrieben", async () => {
  const calls = stubFetch([{ status: 409, json: { message: "Contact already exists. Existing ID: 4711" } }]);
  const result = await hubspotAdapter.onLead!(lead, config);
  assert.equal(calls.length, 1, "nur die Neuanlage, kein PATCH");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(result, { ok: true, existing: true });
});

test("Neuanlage sendet keine leeren Felder", async () => {
  const calls = stubFetch([{ status: 201, json: { id: "99" } }]);
  const result = await hubspotAdapter.onLead!(lead, config);
  assert.deepEqual(calls[0].body?.properties, {
    email: "bestand@example.test",
    message: "Rückruf bitte",
    hs_lead_status: "NEW",
  });
  assert.deepEqual(result, { ok: true, contact_id: "99" });
});
