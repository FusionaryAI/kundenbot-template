import { supaAdmin } from "@/lib/db";
import { llm, embeddingModel } from "@/lib/llm";
import { embeddingText } from "@/lib/knowledge-text";

export { embeddingText };

// Wissenseinträge (knowledge_items) und ihre Such-Vektoren (embeddings) haben
// keinen Fremdschlüssel; zugeordnet wird über tenant_id + Text. Alle Schreib-
// wege laufen hier durch, damit Anlegen, Bearbeiten und Löschen dieselbe
// Zuordnung verwenden.

// PostgREST-Filter stehen im Query-String; ab ~8.000 Zeichen scheitert die
// Anfrage. Daher Vorfilter über ein Präfix, exakter Vergleich in JS.
const CONTENT_PREFIX_LENGTH = 500;

async function findIdsByExactContent(table: "embeddings" | "knowledge_items", tenantId: string, content: string) {
  // Backslash escapen, sonst wirkt er als LIKE-Escape; %/_ verbreitern nur den Vorfilter.
  const prefix = content.slice(0, CONTENT_PREFIX_LENGTH).replace(/\\/g, "\\\\");
  const { data, error } = await supaAdmin
    .from(table)
    .select("id, content")
    .eq("tenant_id", tenantId)
    .like("content", `${prefix}%`);
  if (error) throw error;
  return (data ?? []).filter((row) => row.content === content).map((row) => row.id as string);
}

async function embed(text: string): Promise<number[]> {
  const res = await llm().embeddings.create({ model: embeddingModel(), input: text });
  return res.data[0].embedding;
}

export async function insertEmbedding(tenantId: string, text: string) {
  const vector = await embed(text);
  const { error } = await supaAdmin.from("embeddings").insert({ tenant_id: tenantId, content: text, embedding: vector });
  if (error) throw error;
}

/**
 * Entfernt die Vektoren eines Eintrags. Prüft das aktuelle Format (mit Titel)
 * und das alte (nur Inhalt). Gibt es weitere Einträge mit identischem Text,
 * bleibt für jeden davon ein Vektor stehen.
 */
export async function removeEmbeddings(item: { id: string; tenant_id: string; title: string | null; content: string }) {
  const variants = [...new Set([embeddingText(item.title, item.content), item.content])];
  const toDelete: string[] = [];
  for (const text of variants) {
    const [embeddingIds, sameItems] = await Promise.all([
      findIdsByExactContent("embeddings", item.tenant_id, text),
      text === item.content ? findIdsByExactContent("knowledge_items", item.tenant_id, text) : Promise.resolve([] as string[]),
    ]);
    const others = sameItems.filter((id) => id !== item.id).length;
    toDelete.push(...embeddingIds.slice(others));
  }
  if (toDelete.length === 0) return;
  const { error } = await supaAdmin.from("embeddings").delete().in("id", toDelete);
  if (error) throw error;
}

/** Legt einen Eintrag samt Vektor an; scheitert der Vektor, wird der Eintrag zurückgenommen. */
export async function createKnowledge(tenantId: string, title: string | null, content: string, source = "dashboard") {
  const { data: item, error } = await supaAdmin
    .from("knowledge_items")
    .insert({ tenant_id: tenantId, title, content, source })
    .select("id")
    .single();
  if (error || !item) throw error ?? new Error("insert failed");
  try {
    await insertEmbedding(tenantId, embeddingText(title, content));
  } catch (e) {
    await supaAdmin.from("knowledge_items").delete().eq("id", item.id);
    throw e;
  }
  return item.id as string;
}
