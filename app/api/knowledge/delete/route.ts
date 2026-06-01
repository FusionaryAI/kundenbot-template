import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id ist erforderlich" },
        { status: 400 }
      );
    }

    // Tenant des Eintrags ermitteln und Zugriff prüfen
    const { data: item, error: lookupError } = await supaAdmin
      .from("knowledge_items")
      .select("tenant_id")
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

    // 1. Zugehörige Embeddings löschen
    await supaAdmin
      .from("embeddings")
      .delete()
      .contains("metadata", { knowledge_item_id: id });

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
  } catch (e: any) {
    console.error("/api/knowledge/delete error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}