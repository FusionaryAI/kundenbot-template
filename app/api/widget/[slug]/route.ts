import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { withAiNotice } from "@/lib/ai-notice";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limit = await checkRateLimit(supaAdmin, req.headers, RATE_LIMITS.widget);
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  const { slug } = await params;

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
    // KI-Hinweis serverseitig erzwingen — der Kunde kann ihn nicht wegkonfigurieren.
    welcome_message: withAiNotice(settings?.welcome_message),
  });
}
