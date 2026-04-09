import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, title, content } = body;

    if (!tenant_id || !content) {
      return NextResponse.json(
        { ok: false, error: "tenant_id und content sind erforderlich" },
        { status: 400 }
      );
    }

    // 1. Knowledge Item speichern
    const { data: item, error: itemError } = await supaAdmin
      .from("knowledge_items")
      .insert({
        tenant_id,
        title: title ?? null,
        content,
        source: "dashboard",
      })
      .select("id")
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { ok: false, error: itemError?.message ?? "Fehler beim Speichern" },
        { status: 500 }
      );
    }

    // 2. Embedding generieren
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // 3. Embedding speichern – ohne metadata Spalte
    const { error: embError } = await supaAdmin
      .from("embeddings")
      .insert({
        tenant_id,
        content,
        embedding,
      });

    if (embError) {
      console.error("Embedding insert error:", embError);
      return NextResponse.json(
        { ok: false, error: "Embedding konnte nicht gespeichert werden: " + embError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch (e: any) {
    console.error("/api/knowledge/add error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}