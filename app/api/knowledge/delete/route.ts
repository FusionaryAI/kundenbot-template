import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";

export const runtime = "nodejs";

const bodySchema = z.object({ id: z.string().uuid() });

// Länge des Content-Präfixes, nach dem die DB vorfiltert. Der volle Content
// passt nicht in die URL: PostgREST-Filter stehen im Query-String, und ab
// ~8.000 Zeichen scheitert die Anfrage (414/400). Der exakte Vergleich
// passiert danach in JS.
const CONTENT_PREFIX_LENGTH = 500;

/**
 * IDs aller Zeilen in `table`, deren tenant_id und content exakt passen.
 *
 * Wildcards (%, _, *) im Präfix verbreitern den Vorfilter nur — der exakte
 * Vergleich fängt das ab. Backslash muss escaped werden, sonst würde er als
 * LIKE-Escape Treffer verschlucken.
 */
async function findIdsByExactContent(
  table: "embeddings" | "knowledge_items",
  tenantId: string,
  content: string
) {
  const prefix = content.slice(0, CONTENT_PREFIX_LENGTH).replace(/\\/g, "\\\\");

  const { data, error } = await supaAdmin
    .from(table)
    .select("id, content")
    .eq("tenant_id", tenantId)
    .like("content", `${prefix}%`);

  if (error) throw error;
  return (data ?? []).filter((row) => row.content === content).map((row) => row.id as string);
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "id ist erforderlich" },
        { status: 400 }
      );
    }
    const { id } = parsed.data;

    // Tenant und Content des Eintrags ermitteln und Zugriff prüfen
    const { data: item, error: lookupError } = await supaAdmin
      .from("knowledge_items")
      .select("tenant_id, content")
      .eq("id", id)
      .single();

    if (lookupError || !item) {
      return NextResponse.json(
        { ok: false, error: "Eintrag nicht gefunden" },
        { status: 404 }
      );
    }

    const gate = await requireTenantAccess(req, item.tenant_id);
    if ("error" in gate) return gate.error;

    // 1. Zugehörige Embeddings löschen. Es gibt keinen Fremdschlüssel zwischen
    //    knowledge_items und embeddings; beide werden mit identischem
    //    tenant_id + content geschrieben (knowledge/add, scripts/ingest.ts),
    //    darüber wird zugeordnet. Sauberer wäre langfristig eine Spalte
    //    embeddings.knowledge_item_id mit FK + ON DELETE CASCADE.
    //
    //    Gibt es weitere Einträge mit demselben Content (z.B. doppelter
    //    Ingest), bleibt für jeden davon ein Embedding stehen — sonst wüsste
    //    der Bot deren Inhalt nicht mehr, obwohl er im Dashboard noch steht.
    const [embeddingIds, sameContentItemIds] = await Promise.all([
      findIdsByExactContent("embeddings", item.tenant_id, item.content),
      findIdsByExactContent("knowledge_items", item.tenant_id, item.content),
    ]);
    const remainingItems = sameContentItemIds.filter((itemId) => itemId !== id).length;
    const embeddingIdsToDelete = embeddingIds.slice(remainingItems);

    if (embeddingIdsToDelete.length > 0) {
      const { error: embError } = await supaAdmin
        .from("embeddings")
        .delete()
        .in("id", embeddingIdsToDelete);

      // Ohne gelöschte Embeddings würde der Bot weiter aus dem Inhalt
      // antworten — dann den Eintrag auch nicht löschen (DSGVO: Löschung
      // muss die Verarbeitung tatsächlich beenden).
      if (embError) {
        console.error("/api/knowledge/delete embeddings error:", embError);
        return NextResponse.json(
          { ok: false, error: "Fehler beim Löschen" },
          { status: 500 }
        );
      }
    }

    // 2. Knowledge Item löschen
    const { error } = await supaAdmin
      .from("knowledge_items")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Fehler beim Löschen" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/knowledge/delete error:", e);
    return NextResponse.json(
      { ok: false, error: "server error" },
      { status: 500 }
    );
  }
}
