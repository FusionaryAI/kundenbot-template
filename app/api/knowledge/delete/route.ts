import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";
import { removeEmbeddings } from "@/lib/knowledge";

export const runtime = "nodejs";

const bodySchema = z.object({ id: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "id ist erforderlich" }, { status: 400 });
    }
    const { id } = parsed.data;

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

    // Erst die Vektoren: Scheitert das, bleibt der Eintrag sichtbar statt still
    // weiter beantwortet zu werden (DSGVO — Löschung muss die Verarbeitung beenden).
    try {
      await removeEmbeddings(item);
    } catch (e) {
      console.error("/api/knowledge/delete embeddings error:", e);
      return NextResponse.json({ ok: false, error: "Fehler beim Löschen" }, { status: 500 });
    }

    const { error } = await supaAdmin.from("knowledge_items").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: "Fehler beim Löschen" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/knowledge/delete error:", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
