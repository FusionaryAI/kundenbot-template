import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/auth-server";
import { createKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().trim().max(300).nullish(),
  content: z.string().trim().min(1).max(8000),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Bitte eine Antwort eingeben (max. 8.000 Zeichen)." }, { status: 400 });
    }
    const { tenant_id, title, content } = parsed.data;

    const gate = await requireTenantAccess(req, tenant_id);
    if ("error" in gate) return gate.error;

    const id = await createKnowledge(tenant_id, title || null, content);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("/api/knowledge/add error:", e);
    return NextResponse.json({ ok: false, error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}
