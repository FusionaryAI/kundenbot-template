// Befüllt embeddings.embedding_bge für alle Zeilen, in denen sie noch fehlt
// (Phase 1 der IONOS-Umstellung, siehe docs/ionos-umstellung.md).
// Idempotent: kann beliebig oft laufen und ergänzt nur fehlende Vektoren —
// direkt vor dem Spaltentausch erneut ausführen, um Neuzugänge abzudecken.
// Aufruf: node --experimental-strip-types scripts/reembed.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Dynamische Imports erst nach dotenv; Node (strip-types) verlangt die .ts-Endung.
// @ts-expect-error TS5097 — Endung ist für die direkte Ausführung mit Node nötig
const { supaAdmin } = await import("../lib/db.ts");
// @ts-expect-error TS5097 — Endung ist für die direkte Ausführung mit Node nötig
const { llm, embeddingModel } = await import("../lib/llm.ts");

const TARGET_DIMENSIONS = 1024;

// Schutz vor dem Befüllen mit dem falschen Modell: ohne explizite Einstellung
// wäre das OpenAI-Default aktiv, dessen Vektoren nicht in die Spalte passen.
if (!process.env.LLM_EMBEDDING_MODEL) {
  console.error("LLM_EMBEDDING_MODEL ist nicht gesetzt — Abbruch (würde sonst OpenAI verwenden).");
  process.exit(1);
}

const { data: rows, error } = await supaAdmin
  .from("embeddings")
  .select("id, content")
  .is("embedding_bge", null);
if (error) throw error;

console.log(`Modell: ${embeddingModel()} · ${rows.length} Zeilen ohne embedding_bge`);

let done = 0;
for (const row of rows as Array<{ id: string; content: string }>) {
  const r = await llm().embeddings.create({ model: embeddingModel(), input: row.content });
  const vec = r.data[0].embedding;
  if (vec.length !== TARGET_DIMENSIONS) {
    console.error(`Falsche Dimension ${vec.length} statt ${TARGET_DIMENSIONS} — Abbruch, nichts weiter geschrieben.`);
    process.exit(1);
  }
  const { error: upErr } = await supaAdmin
    .from("embeddings")
    .update({ embedding_bge: vec })
    .eq("id", row.id);
  if (upErr) throw upErr;
  done++;
}

console.log(`✅ ${done} Zeilen befüllt.`);
