// @ts-nocheck
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supaAdmin } from "../lib/db.ts";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/* =========================================================
   CLI Args Helper
========================================================= */
function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}
function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

/* =========================================================
   Embedding Helper (1536-D)
========================================================= */
async function embed(text: string) {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding;
}

/* =========================================================
   Text Cleanup Helpers
========================================================= */
function cleanText(s: string) {
  return (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeBoilerplate(block: string) {
  const t = block.toLowerCase();

  // Cookie/Consent/Tracking Noise
  const cookieHints = [
    "cookie",
    "consent",
    "datenschutz",
    "privacy",
    "tracking",
    "google analytics",
    "matomo",
    "facebook",
    "pixel",
    "zustimmen",
    "ablehnen",
    "einstellungen",
  ];
  const isCookie = cookieHints.some((k) => t.includes(k));

  // Very short / menu-like fragments
  const tooShort = block.trim().length < 40;

  // Mostly punctuation or repeated separators
  const junky = /^[\W_]+$/.test(block.trim());

  return tooShort || junky || isCookie;
}

/* =========================================================
   HTML → Structured Text (better than body.textContent)
========================================================= */
async function extractStructuredTextFromUrl(url: string) {
  console.log(`▶️  Lade URL: ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    console.log(`⚠️  Konnte URL nicht laden (${res.status}): ${url}`);
    return "";
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Remove obvious boilerplate containers before Readability
  const killSelectors = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "header",
    "footer",
    "nav",
    "aside",
    "[aria-hidden='true']",
    "[role='navigation']",
    "[class*='cookie']",
    "[id*='cookie']",
    "[class*='consent']",
    "[id*='consent']",
    "[class*='banner']",
    "[id*='banner']",
  ];

  for (const sel of killSelectors) {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  }

  // Try Readability first
  const reader = new Readability(document);
  const article = reader.parse();

  // If Readability fails, fallback to main/body but with structure
  let contentHtml = article?.content?.trim() || "";

  if (!contentHtml) {
    const main = document.querySelector("main");
    contentHtml = (main ? main.innerHTML : document.body?.innerHTML) || "";
  }

  if (!contentHtml) return "";

  // Parse the chosen content HTML again for structured extraction
  const dom2 = new JSDOM(contentHtml, { url });
  const doc2 = dom2.window.document;

  // Build blocks: headings + paragraphs + list items
  const blocks: string[] = [];

  const nodes = Array.from(
    doc2.querySelectorAll("h1,h2,h3,h4,p,li")
  ) as HTMLElement[];

  for (const n of nodes) {
    const txt = cleanText(n.textContent || "");
    if (!txt) continue;
    if (looksLikeBoilerplate(txt)) continue;

    // Keep headings visible (helps QA)
    const tag = n.tagName.toLowerCase();
    if (tag.startsWith("h")) {
      blocks.push(`\n### ${txt}\n`);
    } else {
      blocks.push(txt);
    }
  }

  const combined = cleanText(blocks.join("\n"));
  return combined;
}

/* =========================================================
   Paragraph-aware chunking (no mid-sentence slicing)
========================================================= */
function chunkByParagraphs(text: string, maxChars = 900, overlapChars = 200) {
  const paras = text
    .split(/\n{1,2}/)
    .map((p) => cleanText(p))
    .filter((p) => p.length > 0 && !looksLikeBoilerplate(p));

  const chunks: string[] = [];
  let current = "";

  for (const p of paras) {
    // If a single paragraph is very long, hard-split it safely by sentences
    if (p.length > maxChars * 1.3) {
      const sentences = p.split(/(?<=[\.\!\?])\s+/).map(cleanText).filter(Boolean);
      for (const s of sentences) {
        if (!s) continue;
        if ((current + " " + s).trim().length > maxChars) {
          if (current.trim()) chunks.push(current.trim());
          current = s;
        } else {
          current = (current ? current + " " : "") + s;
        }
      }
      continue;
    }

    // Normal paragraph packing
    if ((current + "\n" + p).trim().length > maxChars) {
      if (current.trim()) chunks.push(current.trim());

      // overlap: take last overlapChars of previous chunk into next chunk start
      if (overlapChars > 0 && chunks.length > 0) {
        const prev = chunks[chunks.length - 1];
        const overlap = prev.slice(Math.max(0, prev.length - overlapChars));
        current = cleanText(overlap + "\n" + p);
      } else {
        current = p;
      }
    } else {
      current = current ? current + "\n" + p : p;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // final cleanup
  return chunks
    .map((c) => cleanText(c))
    .filter((c) => c.length >= 120); // drop tiny chunks
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

function shouldSkipUrl(url: string, skipPatterns: string[]) {
  const u = url.toLowerCase();
  return skipPatterns.some((p) => u.includes(p));
}

async function crawlSite(startUrl: string, maxPages = 30, skipPatterns: string[] = []) {
  const start = new URL(startUrl);
  const toVisit: string[] = [startUrl];
  const visited = new Set<string>();

  while (toVisit.length > 0 && visited.size < maxPages) {
    const current = toVisit.shift()!;
    const normalized = normalizeUrl(current);
    if (!normalized || visited.has(normalized)) continue;
    if (shouldSkipUrl(normalized, skipPatterns)) continue;

    visited.add(normalized);
    console.log(`🌐 Crawler besucht: ${normalized}`);

    try {
      const res = await fetch(normalized, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
      });
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
        })
        .filter((x) => !shouldSkipUrl(x, skipPatterns));

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
   Simple concurrency runner
========================================================= */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const queue = [...items];
  const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/* =========================================================
   Main
========================================================= */
async function main() {
  const slug = process.argv[2];
  const startUrl = process.argv[3];

  if (!slug || !startUrl) {
    console.log(
      "Usage: npx ts-node scripts/ingest.ts <slug> <start-url> [--fresh] [--maxPages 80] [--concurrency 2] [--skip privacy,datenschutz,impressum]"
    );
    process.exit(1);
  }

  const fresh = hasFlag("--fresh");
  const maxPages = parseInt(getArg("--maxPages") || "30", 10);
  const concurrency = parseInt(getArg("--concurrency") || "1", 10);

  const skipArg = getArg("--skip") || "";
  const skipPatterns = skipArg
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  console.log(`\n=== Ingest für Tenant "${slug}" ab Start-URL "${startUrl}" ===`);
  console.log(
    `Options: fresh=${fresh}, maxPages=${maxPages}, concurrency=${concurrency}, skip=[${skipPatterns.join(
      ", "
    )}]\n`
  );

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

  // Optional: Vor dem Ingest altes Wissen löschen
  if (fresh) {
    console.log("🧹 Lösche vorherige Embeddings & Knowledge Items...");
    const { error: delE } = await supaAdmin
      .from("embeddings")
      .delete()
      .eq("tenant_id", tenant.id);
    if (delE) throw delE;

    const { error: delK } = await supaAdmin
      .from("knowledge_items")
      .delete()
      .eq("tenant_id", tenant.id);
    if (delK) throw delK;

    console.log("✅ Vorherige Daten gelöscht.\n");
  }

  // 1) Seiten crawlen
  const urls = await crawlSite(startUrl, maxPages, skipPatterns);
  if (urls.length === 0) {
    console.log("⚠️  Keine crawlbaren Seiten gefunden.");
    return;
  }

  // 2) Für jede Seite Text extrahieren & speichern
  await runWithConcurrency(urls, concurrency, async (url) => {
    const raw = await extractStructuredTextFromUrl(url);
    if (!raw || raw.length < 200) {
      console.log("⚠️  Sehr wenig Inhalt, skip:", url);
      return;
    }

    const chunks = chunkByParagraphs(raw, 900, 200);
    console.log(`✂️  ${chunks.length} Chunks aus ${url}`);

    for (const c of chunks) {
      const { error: e1 } = await supaAdmin.from("knowledge_items").insert({
        tenant_id: tenant.id,
        source: url,
        content: c,
      });
      if (e1) throw e1;

      const vec = await embed(c);
      const { error: e2 } = await supaAdmin.from("embeddings").insert({
        tenant_id: tenant.id,
        content: c,
        embedding: vec,
      });
      if (e2) throw e2;
    }

    console.log(`✅ Seite verarbeitet: ${url}`);
  });

  console.log("\n🎉 Ingest abgeschlossen.\n");
}

main().catch((err) => {
  console.error("❌ Unhandled Error:", err);
  process.exit(1);
});