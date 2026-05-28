import { supaAdmin } from "@/lib/db";
import { isOutsideBusinessHours, type OpeningHours } from "@/lib/business-hours";

export type RecordTurnInput = {
  tenantId: string;
  conversationId: string;
  isFirstMessage: boolean;
  firstUserMessage?: string | null;
  bestSimilarity: number | null;
  isFallback: boolean;
  openingHours?: OpeningHours | null;
};

// Upserts the analytics row for one chat turn. Designed to be fire-and-forget:
// if it fails (RLS, schema mismatch, …) we swallow and log so the chat reply
// is never blocked by analytics.
export async function recordConversationTurn(input: RecordTurnInput): Promise<void> {
  const {
    tenantId,
    conversationId,
    isFirstMessage,
    firstUserMessage,
    bestSimilarity,
    isFallback,
    openingHours,
  } = input;

  if (!tenantId || !conversationId) return;

  try {
    if (isFirstMessage) {
      const outside = isOutsideBusinessHours(new Date(), openingHours);
      const startSim = typeof bestSimilarity === "number" ? bestSimilarity : 0;
      const samples = typeof bestSimilarity === "number" ? 1 : 0;

      const { error } = await supaAdmin.from("conversation_analytics").upsert(
        {
          tenant_id: tenantId,
          conversation_id: conversationId,
          started_at: new Date().toISOString(),
          message_count: 1,
          first_user_message: firstUserMessage ?? null,
          outside_business_hours: outside,
          fallback_count: isFallback ? 1 : 0,
          similarity_sum: startSim,
          similarity_samples: samples,
          avg_similarity: samples > 0 ? startSim : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,conversation_id", ignoreDuplicates: false }
      );
      if (error) console.error("[analytics] insert error:", error);
      return;
    }

    // Follow-up turn: increment via RPC-less read+update (small race ok for v1)
    const { data: row, error: selErr } = await supaAdmin
      .from("conversation_analytics")
      .select("id, message_count, fallback_count, similarity_sum, similarity_samples")
      .eq("tenant_id", tenantId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (selErr) {
      console.error("[analytics] select error:", selErr);
      return;
    }

    if (!row) {
      // No starting row (e.g. analytics started mid-conversation). Treat as first.
      await recordConversationTurn({ ...input, isFirstMessage: true });
      return;
    }

    const hasSim = typeof bestSimilarity === "number";
    const newSimSum = (row.similarity_sum ?? 0) + (hasSim ? bestSimilarity! : 0);
    const newSamples = (row.similarity_samples ?? 0) + (hasSim ? 1 : 0);
    const newAvg = newSamples > 0 ? newSimSum / newSamples : null;

    const { error: updErr } = await supaAdmin
      .from("conversation_analytics")
      .update({
        message_count: (row.message_count ?? 0) + 1,
        fallback_count: (row.fallback_count ?? 0) + (isFallback ? 1 : 0),
        similarity_sum: newSimSum,
        similarity_samples: newSamples,
        avg_similarity: newAvg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updErr) console.error("[analytics] update error:", updErr);
  } catch (e) {
    console.error("[analytics] unexpected error:", e);
  }
}

// Logs the exact question that the bot could not answer (fallback), so the
// monthly report + dashboard can prompt the customer to update their KB.
// Best-effort; never blocks the chat reply.
export async function recordUnansweredQuestion(
  tenantId: string,
  conversationId: string | null,
  question: string
): Promise<void> {
  if (!tenantId) return;
  const q = (question ?? "").trim();
  if (!q || q.length < 2) return;
  try {
    const { error } = await supaAdmin.from("unanswered_questions").insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      question: q.slice(0, 500),
    });
    if (error) console.error("[analytics] unanswered insert error:", error);
  } catch (e) {
    console.error("[analytics] unanswered unexpected:", e);
  }
}

// Called from /api/leads after a successful insert. Marks the originating
// conversation as having converted.
export async function markConversationAsLead(
  tenantId: string,
  conversationId: string
): Promise<void> {
  if (!tenantId || !conversationId) return;
  try {
    const { error } = await supaAdmin
      .from("conversation_analytics")
      .update({ resulted_in_lead: true, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("conversation_id", conversationId);
    if (error) console.error("[analytics] mark-lead error:", error);
  } catch (e) {
    console.error("[analytics] mark-lead unexpected:", e);
  }
}
