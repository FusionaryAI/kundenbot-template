import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clientIp, rateLimitKey, tooManyRequests, type RpcClient } from "./rate-limit.ts";

const rule = { scope: "chat", limit: 2, windowSeconds: 60 };
const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

/** Simuliert rate_limit_hit: zählt pro Schlüssel hoch. */
function fakeDb(): RpcClient & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async rpc(_fn, args) {
      const key = args.p_key as string;
      keys.push(key);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { data: { count, reset_at: new Date(1_000_000 + 30_000).toISOString() }, error: null };
    },
  };
}

test("clientIp nimmt den ersten Eintrag aus x-forwarded-for", () => {
  assert.equal(clientIp(headers), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("Schlüssel enthält die IP nicht im Klartext und hängt am Secret", () => {
  const a = rateLimitKey("chat", "203.0.113.7", "secret-a");
  assert.ok(a.startsWith("chat:"));
  assert.ok(!a.includes("203.0.113.7"));
  assert.notEqual(a, rateLimitKey("chat", "203.0.113.7", "secret-b"));
  assert.notEqual(a, rateLimitKey("leads", "203.0.113.7", "secret-a"));
});

test("Bis zum Limit erlaubt, danach gesperrt mit Retry-After", async () => {
  const db = fakeDb();
  assert.deepEqual(await checkRateLimit(db, headers, rule, 1_000_000), { limited: false });
  assert.deepEqual(await checkRateLimit(db, headers, rule, 1_000_000), { limited: false });
  assert.deepEqual(await checkRateLimit(db, headers, rule, 1_000_000), {
    limited: true,
    retryAfterSeconds: 30,
  });
});

test("Andere IP hat einen eigenen Zähler", async () => {
  const db = fakeDb();
  for (let i = 0; i < 3; i++) await checkRateLimit(db, headers, rule);
  const other = new Headers({ "x-forwarded-for": "198.51.100.9" });
  assert.deepEqual(await checkRateLimit(db, other, rule), { limited: false });
});

test("Fail open, wenn der Zähler nicht erreichbar ist", async () => {
  const broken: RpcClient = {
    async rpc() {
      return { data: null, error: { message: "connection refused" } };
    },
  };
  const origError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await checkRateLimit(broken, headers, rule), { limited: false });
  } finally {
    console.error = origError;
  }
});

test("429-Antwort trägt Retry-After und eine anzeigbare Meldung", async () => {
  const res = tooManyRequests(42);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "42");
  const body = await res.json();
  assert.match(body.error, /Zu viele Anfragen/);
});
