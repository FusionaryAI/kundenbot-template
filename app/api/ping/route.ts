import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export async function GET() {
  const { count, error } = await supaAdmin
    .from("tenants")
    .select("*", { count: "exact", head: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tenants: count ?? 0 });
}
