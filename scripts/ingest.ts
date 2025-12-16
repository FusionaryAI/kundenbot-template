// @ts-nocheck
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supaAdmin } from "../lib/db.ts";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/* =========================================================
   Embedding Helper (1536-D, passend zu vector(1536))
========================================================= */
async function embed(text: string) {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small", // WICHTIG: 1536 Dimensionen
    input: text,
  });
  return r.data[0].embedding;
}

/* =========================================================
   HTML → Text
========================================================= */
async function extractTextFromUrl(url: string) {
  console.log(`▶️  Lade URL: ${url}`);
  const res = await fetch(url);

  if (!res.ok) {
    console.log(`⚠️  Konnte URL nicht laden (${res.status}): ${url}`);
    return "";
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const text =
    article?.textContent?.trim() ||
    dom.window.document.body.textContent?.replace(/\s+/g, " ").trim() ||
    "";

  return text;
}

/* =========================================================
   Chunking
========================================================= */
function chunk(text: string, size = 800, overlap = 150) {
  const out: string[] = [];
  let i = 0;

  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
  }

  return out
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/* =========================================================
   Crawler
========================================================= */
function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function isSameHost(base: URL, candidate: URL) {
  return base.hostname === candidate.hostname;
}

function isCrawlableLink(href: string | null) {
  if (!href) return false;
  if (href.startsWith("mailto:")) return false;
  if (href.startsWith("tel:")) return false;
  if (href.startsWith("javascript:")) return false;
  if (href.endsWith(".pdf")) return false;
  if (href.match(/\.(jpg|jpeg|png|webp|gif)$/i)) return false;
  return true;
}

async function crawlSite(startUrl: string, maxPages = 15) {
  const start = new URL(startUrl);
  const toVisit: string[] = [startUrl];
  const visited = new Set<string>();

  while (toVisit.length > 0 && visited.size < maxPages) {
    const current = toVisit.shift()!;
    const normalized = normalizeUrl(current);
    if (!normalized || visited.has(normalized)) continue;

    visited.add(normalized);
    console.log(`🌐 Crawler besucht: ${normalized}`);

    try {
      const res = await fetch(normalized);
      if (!res.ok) continue;

      const html = await res.text();
      const dom = new JSDOM(html, { url: normalized });
      const document = dom.window.document;

      const foundLinks = Array.from(document.querySelectorAll("a"))
        .map((a: any) => a.getAttribute("href"))
        .filter(isCrawlableLink)
        .map((href) => {
          try {
            return new URL(href!, normalized).toString();
          } catch {
            return null;
          }
        })
        .filter((x): x is string => !!x)
        .map((x) => normalizeUrl(x))
        .filter((x): x is string => !!x)
        .filter((x) => {
          try {
            return isSameHost(start, new URL(x));
          } catch {
            return false;
          }
        });

      for (const link of foundLinks) {
        if (!visited.has(link) && !toVisit.includes(link)) {
          if (visited.size + toVisit.length < maxPages) {
            toVisit.push(link);
          }
        }
      }
    } catch (e) {
      console.log(`⚠️  Fehler beim Crawlen von ${normalized}:`, e);
      continue;
    }
  }

  console.log(`✅ Crawler fertig. Seiten gefunden: ${visited.size}`);
  return Array.from(visited);
}

/* =========================================================
   Main
========================================================= */
async function main() {
  const slug = process.argv[2];
  const startUrl = process.argv[3];

  if (!slug || !startUrl) {
    console.log("Usage: ts-node scripts/ingest.ts <slug> <start-url>");
    process.exit(1);
  }

  console.log(`\n=== Ingest für Tenant "${slug}" ab Start-URL "${startUrl}" ===\n`);

  // Tenant holen
  const { data: tenant, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !tenant) {
    console.error("❌ Tenant nicht gefunden:", slug, error);
    process.exit(1);
  }

  // 1) Seiten crawlen
  const urls = await crawlSite(startUrl, 15);
  if (urls.length === 0) {
    console.log("⚠️  Keine crawlbaren Seiten gefunden.");
    return;
  }

  // 2) Für jede Seite Text extrahieren & speichern
  for (const url of urls) {
    const raw = await extractTextFromUrl(url);
    if (!raw || raw.length < 20) {
      console.log("⚠️  Leere oder sehr kurze Seite:", url);
      continue;
    }

    const chunks = chunk(raw, 800, 150);
    console.log(`✂️  ${chunks.length} Chunks aus ${url}`);

    for (const c of chunks) {
      // knowledge_items: tenant_id, source, content
      const { error: e1 } = await supaAdmin
        .from("knowledge_items")
        .insert({
          tenant_id: tenant.id,
          source: url,
          content: c,
        });

      if (e1) {
        console.error("❌ Fehler knowledge_items:", e1);
        throw e1;
      }

      // embeddings: tenant_id, content, embedding (1536-D)
      const vec = await embed(c);
      const { error: e2 } = await supaAdmin.from("embeddings").insert({
        tenant_id: tenant.id,
        content: c,
        embedding: vec,
      });

      if (e2) {
        console.error("❌ Fehler embeddings:", e2);
        throw e2;
      }

      console.log(`✅ Chunk gespeichert (${url})`);
    }
  }

  console.log("\n🎉 Ingest abgeschlossen.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
