import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id erforderlich" },
        { status: 400 }
      );
    }

    const { data: lead, error: fetchError } = await supaAdmin
      .from("leads")
      .select("metadata")
      .eq("id", id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json(
        { ok: false, error: "Lead nicht gefunden" },
        { status: 404 }
      );
    }

    const updatedMetadata = {
      ...(lead.metadata ?? {}),
      notes: notes ?? "",
    };

    const { error } = await supaAdmin
      .from("leads")
      .update({
        status,
        metadata: updatedMetadata,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}