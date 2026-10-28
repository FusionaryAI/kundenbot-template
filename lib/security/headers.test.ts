import { test } from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "./headers.ts";

type Rule = { source: string; headers: { key: string; value: string }[] };

/** Sammelt alle Header, die Next.js für einen Pfad setzen würde (Quellen als Pfad-Regex). */
function headersFor(rules: Rule[], path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    const pattern = "^" + r.source.replace("/:path*", "(?:/.*)?") + "$";
    if (new RegExp(pattern).test(path)) {
      for (const h of r.headers) {
        assert.ok(!(h.key in out), `Header doppelt gesetzt für ${path}: ${h.key}`);
        out[h.key] = h.value;
      }
    }
  }
  return out;
}

const prod = securityHeaders({ dev: false });

test("Dashboard, Admin und Login sind nicht einbettbar", () => {
  for (const path of ["/dashboard", "/admin/kunde-a", "/login", "/"]) {
    const h = headersFor(prod, path);
    assert.equal(h["X-Frame-Options"], "DENY", path);
    assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/, path);
  }
});

test("das Chat-Embed bleibt auf Kundenseiten einbettbar", () => {
  const h = headersFor(prod, "/embed/kunde-a");
  assert.equal(h["X-Frame-Options"], undefined);
  assert.match(h["Content-Security-Policy"], /frame-ancestors \*/);
});

test("Grundschutz gilt überall", () => {
  for (const path of ["/embed/kunde-a", "/dashboard", "/api/chat", "/widget.js"]) {
    const h = headersFor(prod, path);
    assert.equal(h["X-Content-Type-Options"], "nosniff", path);
    assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin", path);
    assert.match(h["Permissions-Policy"], /camera=\(\)/, path);
  }
});

test("CSP: keine fremden Skripte, Bilder nur von der eigenen Origin, eval nur im Dev-Modus", () => {
  const csp = headersFor(prod, "/dashboard")["Content-Security-Policy"];
  assert.match(csp, /script-src 'self' 'unsafe-inline';/);
  assert.match(csp, /img-src 'self' data: blob:;/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  const dev = headersFor(securityHeaders({ dev: true }), "/dashboard")["Content-Security-Policy"];
  assert.match(dev, /'unsafe-eval'/);
});
