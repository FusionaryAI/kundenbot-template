import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";
import { resolveVertical } from "@/lib/verticals/registry";
import { guardrailReply } from "@/lib/verticals/guardrail-reply";
import { assessMatches, generateKbAnswer, ragSearch } from "@/lib/rag";
import { embeddingText } from "@/lib/knowledge";
import { ragThresholds } from "@/lib/llm";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenant_id: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
});

export type TestMode = "sicher" | "unsicher" | "keine" | "schutzregel";

export type TestSource = {
  itemId: string | null;
  title: string | null;
  content: string;
  fit: "hoch" | "mittel" | "gering";
};

/**
 * Wissenstest: zeigt, wie der Assistent auf eine Frage antworten würde und
 * auf welche Einträge er sich stützt. Nutzt dieselben Bausteine wie der Chat
 * (lib/rag.ts, Branchen-Guardrail), schreibt aber keine Statistik und legt
 * keine Anfrage an.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Bitte eine Frage eingeben." }, { status: 400 });
    }
    const { tenant_id, question } = parsed.data;

    const gate = await requireTenantAccess(req, tenant_id);
    if ("error" in gate) return gate.error;

    const limit = await checkRateLimit(supaAdmin, req.headers, RATE_LIMITS.knowledgeTest);
    if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

    const [{ data: tenant }, { data: settings }] = await Promise.all([
      supaAdmin.from("tenants").select("id, name, vertical").eq("id", tenant_id).single(),
      supaAdmin
        .from("tenant_settings")
        .select("fallback_message, lead_enabled, public_contact_phone, public_hours")
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
    ]);
    if (!tenant) return NextResponse.json({ ok: false, error: "Kunde nicht gefunden" }, { status: 404 });

    const profile = resolveVertical(tenant);
    const fallback = settings?.fallback_message || "Leider habe ich hierzu noch keine Informationen hinterlegt.";
    const leadEnabled = settings?.lead_enabled !== false;

    if (profile.adviceGuardrail?.matches(question)) {
      return NextResponse.json({
        ok: true,
        mode: "schutzregel" satisfies TestMode,
        answer: guardrailReply(profile.adviceGuardrail, {
          phone: settings?.public_contact_phone,
          hours: settings?.public_hours,
        }),
        note: leadEnabled
          ? "Die Schutzregel der Branche greift. Im Chat bietet der Assistent zusätzlich an, eine Terminanfrage aufzunehmen."
          : "Die Schutzregel der Branche greift — der Assistent beantwortet das bewusst nicht inhaltlich.",
        sources: [],
      });
    }

    const rag = assessMatches(await ragSearch(tenant_id, question, 4));

    if (!rag.best || !rag.goodEnough) {
      return NextResponse.json({
        ok: true,
        mode: "keine" satisfies TestMode,
        answer: leadEnabled
          ? "Dazu habe ich aktuell keine hinterlegten Informationen. Soll ich Ihre Frage an das Team weiterleiten?"
          : fallback,
        note: "Kein Eintrag passt gut genug. Ergänzen Sie die Antwort, damit der Assistent sie künftig kennt.",
        sources: [],
      });
    }

    const answer = await generateKbAnswer({
      companyName: tenant.name,
      fallbackMessage: fallback,
      safetyHint: profile.safetyHint,
      kbAnswerInstruction: profile.kbAnswerInstruction,
      kbBullets: rag.kbBullets,
      message: question,
    });

    const { data: items } = await supaAdmin.from("knowledge_items").select("id, title, content").eq("tenant_id", tenant_id);
    const t = ragThresholds();
    const sources: TestSource[] = rag.top.map((m) => {
      const item = (items ?? []).find((i) => embeddingText(i.title, i.content) === m.content || i.content === m.content);
      return {
        itemId: item?.id ?? null,
        title: item?.title ?? null,
        content: item?.content ?? m.content,
        fit: m.similarity >= t.high ? "hoch" : m.similarity >= t.mid ? "mittel" : "gering",
      };
    });

    return NextResponse.json({
      ok: true,
      mode: (rag.highConf ? "sicher" : "unsicher") satisfies TestMode,
      answer: answer ?? fallback,
      note: rag.highConf
        ? null
        : "Die Treffer passen nur teilweise. Im Chat prüft der Assistent hier zusätzlich, ob sie reichen, und bietet sonst die Weiterleitung an.",
      sources,
    });
  } catch (e) {
    console.error("/api/knowledge/test error:", e);
    return NextResponse.json({ ok: false, error: "Test fehlgeschlagen" }, { status: 500 });
  }
}
