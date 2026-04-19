import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;

  const { data: tenant, error: tenantError } = await supaAdmin
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { data: settings } = await supaAdmin
    .from("tenant_settings")
    .select("welcome_message")
    .eq("tenant_id", tenant.id)
    .single();

  return NextResponse.json({
    ok: true,
    tenant_name: tenant.name,
    welcome_message: settings?.welcome_message?.trim() || "Hallo! Wie kann ich Ihnen helfen?",
  });
}
