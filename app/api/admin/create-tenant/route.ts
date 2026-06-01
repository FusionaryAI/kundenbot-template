import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireSuperAdmin(req);
    if ("error" in gate) return gate.error;

    const body = await req.json();
    const {
      name,
      slug,
      welcome_message,
      fallback_message,
      lead_email,
      lead_auto_reply,
      client_email,
      client_password,
    } = body;

    if (!name || !slug || !lead_email || !client_email || !client_password) {
      return NextResponse.json(
        { ok: false, error: "Pflichtfelder fehlen" },
        { status: 400 }
      );
    }

    // 1. Prüfen ob Slug bereits existiert
    const { data: existing } = await supaAdmin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Dieser Slug ist bereits vergeben" },
        { status: 400 }
      );
    }

    // 2. Tenant anlegen
    const { data: tenant, error: tenantError } = await supaAdmin
      .from("tenants")
      .insert({ name, slug })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { ok: false, error: tenantError?.message ?? "Tenant konnte nicht erstellt werden" },
        { status: 500 }
      );
    }

    // 3. Tenant Settings anlegen
    const { error: settingsError } = await supaAdmin
      .from("tenant_settings")
      .insert({
        tenant_id: tenant.id,
        welcome_message: welcome_message ?? "Hallo! Wie kann ich Ihnen helfen?",
        fallback_message: fallback_message ?? "Dazu habe ich leider keine Informationen.",
        lead_enabled: true,
        lead_email,
        lead_auto_reply: lead_auto_reply ?? "Vielen Dank! Wir melden uns zeitnah.",
      });

    if (settingsError) {
      // Tenant wieder löschen bei Fehler
      await supaAdmin.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json(
        { ok: false, error: "Settings konnten nicht erstellt werden" },
        { status: 500 }
      );
    }

    // 4. Kunden-User anlegen
    const { data: userData, error: userError } =
      await supaAdmin.auth.admin.createUser({
        email: client_email,
        password: client_password,
        email_confirm: true,
      });

    if (userError || !userData.user) {
      // Tenant und Settings wieder löschen
      await supaAdmin.from("tenant_settings").delete().eq("tenant_id", tenant.id);
      await supaAdmin.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json(
        { ok: false, error: userError?.message ?? "User konnte nicht erstellt werden" },
        { status: 500 }
      );
    }

    // 5. Rolle zuweisen
    const { error: roleError } = await supaAdmin
      .from("user_roles")
      .insert({
        user_id: userData.user.id,
        role: "client",
        tenant_id: tenant.id,
      });

    if (roleError) {
      // Alles rückgängig machen
      await supaAdmin.auth.admin.deleteUser(userData.user.id);
      await supaAdmin.from("tenant_settings").delete().eq("tenant_id", tenant.id);
      await supaAdmin.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json(
        { ok: false, error: "Rollenzuweisung fehlgeschlagen" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tenant_id: tenant.id,
      slug,
    });
  } catch (e: any) {
    console.error("/api/admin/create-tenant error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}