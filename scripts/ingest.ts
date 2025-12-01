// @ts-nocheck
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supaAdmin } from "../lib/db.ts"; // .ts-Endung ist richtig im ESM-Modus
import OpenAI from "openai";
// Node 18+ hat global fetch – dein Import funktioniert aber auch:
// import fetch from "node-fetch";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function embed(text: string) {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return r.data[0].embedding;
}

async function extractTextFromUrl(url: string) {
  const res = await fetch(url);
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const art = reader.parse();

  const text =
    art?.textContent?.trim() ||
    dom.window.document.body.textContent?.replace(/\s+/g, " ").trim() ||
    "";

  return text;
}

// feinere Chunks + Überlappung für bessere Treffer
function chunk(text: string, size = 800, overlap = 150) {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return out.map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

async function main() {
  const slug = process.argv[2];
  const url = process.argv[3];
  if (!slug || !url) {
    console.log("Usage: ts-node scripts/ingest.ts <slug> <url>");
    process.exit(1);
  }

  const { data: tenant, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !tenant) throw error || new Error("Tenant not found");

  const raw = await extractTextFromUrl(url);

  // <-- Schutz gegen leere/zu kurze Seiten
  if (!raw || raw.length < 10) {
    console.log("⚠️  WARN: empty or tiny page:", url);
    return;
  }

  const chunks = chunk(raw, 800, 150);

  for (const c of chunks) {
    const { data: ki, error: e1 } = await supaAdmin
      .from("knowledge_items")
      .insert({ tenant_id: tenant.id, source: url, raw_text: c })
      .select()
      .single();
    if (e1) throw e1;

    const vec = await embed(c);
    const { error: e2 } = await supaAdmin.from("embeddings").insert({
      tenant_id: tenant.id,
      knowledge_item_id: ki.id,
      content: c,
      embedding: vec,
    });
    if (e2) throw e2;

    console.log("Chunk gespeichert");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

