import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { createLead, LeadError } from "@/lib/leads";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// Öffentlicher Endpunkt: Längen begrenzen (Speicher, E-Mail-Inhalt, LLM-Prompt)
// und unbekannte Felder verwerfen (Datenminimierung).
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || undefined);
const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => v || null);

const leadSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  type: z.enum(["contact", "appointment", "callback"]).catch("contact"),
  name: optionalText(200),
  email: optionalText(254),
  phone: optionalText(50),
  preferred_contact: z.enum(["email", "phone"]).nullish().catch(null).transform((v) => v ?? null),
  message: z.string().trim().min(1).max(5000),
  appointment_topic: nullableText(500),
  appointment_window: nullableText(500),
  conversation_id: nullableText(100),
  metadata: z
    .object({
      source: z.string().max(50).optional(),
      lead_type: z.string().max(20).optional(),
      first_name: z.string().max(100).nullish(),
      last_name: z.string().max(100).nullish(),
      conversation_id: z.string().max(100).nullish(),
      page_context: z
        .object({
          page_url: z.string().max(2000).nullish(),
          page_path: z.string().max(2000).nullish(),
          page_title: z.string().max(500).nullish(),
          tenant_label: z.string().max(200).nullish(),
          surface: z.string().max(50).nullish(),
        })
        .nullish(),
    })
    .catch({ source: "chat" })
    .default({ source: "chat" }),
});

export async function POST(req: NextRequest) {
  const limit = await checkRateLimit(supaAdmin, req.headers, RATE_LIMITS.leads);
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = leadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const result = await createLead({
      ...input,
      conversation_id: input.conversation_id ?? input.metadata.conversation_id ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    if (e instanceof LeadError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("/api/leads error:", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
