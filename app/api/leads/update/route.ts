import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["neu", "in_bearbeitung", "erledigt"]),
  notes: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Ungültige Eingabe" }, { status: 400 });
    }
    const { id, status, notes } = parsed.data;

    const { data: lead, error: fetchError } = await supaAdmin
      .from("leads")
      .select("metadata, tenant_id")
      .eq("id", id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ ok: false, error: "Lead nicht gefunden" }, { status: 404 });
    }

    const gate = await requireTenantAccess(req, lead.tenant_id);
    if ("error" in gate) return gate.error;

    const { error } = await supaAdmin
      .from("leads")
      .update({
        status,
        // Fehlt notes, bleibt die bestehende Notiz erhalten.
        metadata: notes === undefined ? lead.metadata : { ...(lead.metadata ?? {}), notes },
      })
      .eq("id", id);

    if (error) {
      console.error("/api/leads/update error:", error.message);
      return NextResponse.json({ ok: false, error: "Speichern fehlgeschlagen" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/leads/update error:", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
