import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, slack_webhook_url, hubspot_api_key, pipedrive_api_key } = body;

    if (!tenant_id) {
      return NextResponse.json({ ok: false, error: "tenant_id erforderlich" }, { status: 400 });
    }

    const gate = await requireTenantAccess(req, tenant_id);
    if ("error" in gate) return gate.error;

    const { error } = await supaAdmin
      .from("tenant_settings")
      .update({
        slack_webhook_url: slack_webhook_url ?? null,
        hubspot_api_key: hubspot_api_key ?? null,
        pipedrive_api_key: pipedrive_api_key ?? null,
      })
      .eq("tenant_id", tenant_id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}