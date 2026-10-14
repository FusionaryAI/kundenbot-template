import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";
import { embeddingText, insertEmbedding, removeEmbeddings } from "@/lib/knowledge";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(300).nullish(),
  content: z.string().trim().min(1).max(8000),
});

/**
 * Korrigiert einen Wissenseintrag: Text ändern und den Such-Vektor neu
 * berechnen. Alte Vektoren zuerst entfernen (sonst würde z. B. beim Löschen
 * des Titels der neue Vektor gleich mitgelöscht); scheitert der neue, wird der
 * alte wiederhergestellt, damit der Eintrag nie ohne Vektor bleibt.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Bitte eine Antwort eingeben (max. 8.000 Zeichen)." }, { status: 400 });
    }
    const { id, content } = parsed.data;
    const title = parsed.data.title || null;

    const { data: item, error: lookupError } = await supaAdmin
      .from("knowledge_items")
      .select("id, tenant_id, title, content")
      .eq("id", id)
      .single();
    if (lookupError || !item) {
      return NextResponse.json({ ok: false, error: "Eintrag nicht gefunden" }, { status: 404 });
    }

    const gate = await requireTenantAccess(req, item.tenant_id);
    if ("error" in gate) return gate.error;

    if (item.title === title && item.content === content) return NextResponse.json({ ok: true });

    await removeEmbeddings(item);
    try {
      await insertEmbedding(item.tenant_id, embeddingText(title, content));
    } catch (e) {
      await insertEmbedding(item.tenant_id, embeddingText(item.title, item.content)).catch(() => {});
      throw e;
    }

    const { error } = await supaAdmin.from("knowledge_items").update({ title, content }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/knowledge/update error:", e);
    return NextResponse.json({ ok: false, error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}
