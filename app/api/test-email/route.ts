import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const to = (body?.to || "").trim();
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to' email" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" }, { status: 500 });
    }
    if (!from) {
      return NextResponse.json({ ok: false, error: "RESEND_FROM not set" }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from,
      to,
      subject: "Fusionary AI – Testmail (Resend)",
      text: "Wenn du das liest, funktioniert Resend aus deinem Next.js Projekt.",
    });

    if ((result as any)?.error) {
      return NextResponse.json({ ok: false, error: (result as any).error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}