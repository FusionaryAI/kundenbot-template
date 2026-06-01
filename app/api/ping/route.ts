import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

// Health-Check: prüft nur die DB-Erreichbarkeit, gibt aber keine
// internen Zahlen (Tenant-Anzahl) oder Fehlerdetails nach außen.
export async function GET() {
  const { error } = await supaAdmin
    .from("tenants")
    .select("*", { count: "exact", head: true });

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
