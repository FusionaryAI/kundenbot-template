import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, tenant_id } = body;

    if (!email || !password || !tenant_id) {
      return NextResponse.json(
        { ok: false, error: "email, password und tenant_id sind erforderlich" },
        { status: 400 }
      );
    }

    // 1. User in Supabase Auth anlegen
    const { data: userData, error: userError } =
      await supaAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (userError || !userData.user) {
      return NextResponse.json(
        { ok: false, error: userError?.message ?? "User konnte nicht erstellt werden" },
        { status: 500 }
      );
    }

    // 2. Rolle in user_roles eintragen
    const { error: roleError } = await supaAdmin.from("user_roles").insert({
      user_id: userData.user.id,
      role: "client",
      tenant_id,
    });

    if (roleError) {
      // User wieder löschen wenn Rollenzuweisung fehlschlägt
      await supaAdmin.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json(
        { ok: false, error: "Rollenzuweisung fehlgeschlagen" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      user_id: userData.user.id,
      email: userData.user.email,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}