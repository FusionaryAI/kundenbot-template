import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

type DayHours = { open: string; close: string } | null;
type OpeningHours = Record<string, DayHours>;

const DAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

function isValidTime(s: unknown): s is string {
  return typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);
}

function sanitizeOpeningHours(input: unknown): OpeningHours | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const out: OpeningHours = {};
  for (const k of DAY_KEYS) {
    const v = obj[k];
    if (!v) {
      out[k] = null;
      continue;
    }
    if (typeof v === "object" && v !== null) {
      const vv = v as { open?: unknown; close?: unknown };
      if (isValidTime(vv.open) && isValidTime(vv.close)) {
        out[k] = { open: vv.open, close: vv.close };
        continue;
      }
    }
    out[k] = null;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      hourly_rate_eur,
      avg_handling_time_minutes,
      opening_hours,
    } = body ?? {};

    if (!tenant_id) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    if (hourly_rate_eur !== undefined) {
      const n = Number(hourly_rate_eur);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        return NextResponse.json(
          { ok: false, error: "hourly_rate_eur must be 0–1000" },
          { status: 400 }
        );
      }
      update.hourly_rate_eur = n;
    }

    if (avg_handling_time_minutes !== undefined) {
      const n = Number(avg_handling_time_minutes);
      if (!Number.isFinite(n) || n < 0.5 || n > 120) {
        return NextResponse.json(
          { ok: false, error: "avg_handling_time_minutes must be 0.5–120" },
          { status: 400 }
        );
      }
      update.avg_handling_time_minutes = n;
    }

    if (opening_hours !== undefined) {
      const cleaned = sanitizeOpeningHours(opening_hours);
      if (!cleaned) {
        return NextResponse.json({ ok: false, error: "invalid opening_hours" }, { status: 400 });
      }
      update.opening_hours = cleaned;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
    }

    const { error } = await supaAdmin.from("tenants").update(update).eq("id", tenant_id);

    if (error) {
      console.error("[settings/wirkung] update error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[settings/wirkung] error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}
