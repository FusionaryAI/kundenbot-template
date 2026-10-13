import OpenAI from "openai";

// Zentraler LLM-Zugang für Chat-Completions und Embeddings.
// Der Anbieter ist per Env austauschbar — jede OpenAI-kompatible API
// funktioniert (OpenAI, IONOS AI Model Hub, Ollama/vLLM):
//
//   LLM_BASE_URL         API-Endpunkt des Anbieters (leer = api.openai.com)
//   LLM_API_KEY          Key des Anbieters (leer = OPENAI_API_KEY)
//   LLM_CHAT_MODEL       Chat-Modell (leer = gpt-4o-mini)
//   LLM_EMBEDDING_MODEL  Embedding-Modell (leer = text-embedding-3-small)
//
// ACHTUNG Embeddings: Ein anderes Embedding-Modell liefert andere Vektor-
// Dimensionen. Die Supabase-Tabelle `embeddings` und `match_embeddings` sind
// auf 1536 Dimensionen festgelegt — ein Modellwechsel braucht eine DB-Migration
// und einen Neu-Ingest ALLER Tenants. Query- und Dokument-Embeddings müssen
// immer vom selben Modell stammen.

// Funktionen statt Konstanten, damit Env-Variablen erst beim Aufruf gelesen
// werden — Skripte wie scripts/ingest.ts laden .env.local per dotenv NACH dem
// Import dieses Moduls (ESM-Imports werden gehoisted).
export function chatModel(): string {
  return process.env.LLM_CHAT_MODEL || "gpt-4o-mini";
}

export function embeddingModel(): string {
  return process.env.LLM_EMBEDDING_MODEL || "text-embedding-3-small";
}

// Sicherheit: OPENAI_API_KEY gilt nur für api.openai.com. Bei gesetzter
// LLM_BASE_URL (Fremdanbieter) greift er bewusst NICHT als Fallback, damit
// der OpenAI-Key nie an einen fremden Host gesendet wird. Anbieter ohne
// Key-Pflicht (z. B. lokales Ollama): LLM_API_KEY auf einen Dummy-Wert setzen.
function resolveApiKey(): string | undefined {
  if (process.env.LLM_API_KEY) return process.env.LLM_API_KEY;
  if (!process.env.LLM_BASE_URL) return process.env.OPENAI_API_KEY;
  return undefined;
}

export function hasLlmApiKey(): boolean {
  return !!resolveApiKey();
}

// Modelle verpacken JSON trotz "ausschließlich JSON"-Anweisung oft in
// ```json-Fences (gpt-4o-mini gelegentlich, offene Modelle häufiger). Ohne
// Entfernen scheitert JSON.parse und die Route fällt still auf Defaults zurück.
// Rückgabe `any` wie JSON.parse selbst: Jeder Aufrufer prüft die Felder einzeln.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJsonReply(raw: string): any {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(fenced ? fenced[1] : raw);
}

// Lazy statt Modul-Ebene: Routen mit Fallback-Pfad ohne Key (z. B. das
// Lead-Briefing) dürfen nicht schon beim Import scheitern.
let client: OpenAI | null = null;

export function llm(): OpenAI {
  if (!client) {
    const apiKey = resolveApiKey();
    // Fail closed: Bei apiKey === undefined liest das SDK selbst OPENAI_API_KEY
    // (Default-Parameter im Konstruktor) und schickte ihn an LLM_BASE_URL.
    if (!apiKey) {
      throw new Error("LLM_API_KEY fehlt (bei gesetzter LLM_BASE_URL Pflicht)");
    }
    const foreignHost = !!process.env.LLM_BASE_URL;
    client = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL || undefined,
      // Gleiches Muster für OPENAI_ORG_ID / OPENAI_PROJECT_ID: nie an Fremdhosts.
      ...(foreignHost ? { organization: null, project: null } : {}),
    });
  }
  return client;
}

// RAG-Schwellen hängen am Embedding-Modell: Jedes Modell hat einen eigenen
// Wertebereich für Ähnlichkeiten. BGE M3 am 13.10.2026 linear auf die
// OpenAI-Werte abgebildet (21 Testfragen, 2 Tenants, r = 0,94) — bei neuen
// Tenants mit stark anderem Inhalt nachkalibrieren.
const RAG_THRESHOLDS = {
  "text-embedding-3-small": { min: 0.30, goodEnough: 0.32, mid: 0.35, highAlt: 0.38, high: 0.45, margin: 0.08 },
  "BAAI/bge-m3": { min: 0.43, goodEnough: 0.44, mid: 0.46, highAlt: 0.48, high: 0.52, margin: 0.05 },
} as const;

export function ragThresholds() {
  const t = RAG_THRESHOLDS[embeddingModel() as keyof typeof RAG_THRESHOLDS];
  // Bewusst kein Fallback: unkalibrierte Schwellen ließen den Bot schwache
  // Treffer als sichere Antworten ausgeben.
  if (!t) throw new Error(`Keine RAG-Schwellen für Embedding-Modell ${embeddingModel()}`);
  return t;
}
