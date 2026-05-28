import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Updates a tenant's lead/report recipient email (tenant_settings.lead_email).
// super_admin-only write — guarded by service role + caller must be super_admin.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : null;
    const rawEmail = typeof body?.lead_email === "string" ? body.lead_email.trim() : "";

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }
    // Empty string clears the email; otherwise must be valid.
    const email = rawEmail === "" ? null : rawEmail;
    if (email !== null && !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "ungültige E-Mail-Adresse" }, { status: 400 });
    }

    // Verify caller is a super_admin (Bearer access token from the client).
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { data: userData, error: userErr } = await supaAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { data: roleRow } = await supaAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    if (roleRow?.role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // No unique constraint on tenant_settings.tenant_id, so we can't ON CONFLICT.
    // Update first; if no row existed, insert one.
    const { data: updated, error: updErr } = await supaAdmin
      .from("tenant_settings")
      .update({ lead_email: email })
      .eq("tenant_id", tenantId)
      .select("tenant_id");

    if (updErr) {
      console.error("[admin/tenant-email] update error:", updErr);
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      const { error: insErr } = await supaAdmin
        .from("tenant_settings")
        .insert({ tenant_id: tenantId, lead_email: email });
      if (insErr) {
        console.error("[admin/tenant-email] insert error:", insErr);
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, lead_email: email });
  } catch (e: any) {
    console.error("[admin/tenant-email] error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}
