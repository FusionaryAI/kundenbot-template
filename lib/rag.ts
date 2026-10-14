import { supaAdmin } from "@/lib/db";
import { llm, chatModel, embeddingModel, ragThresholds } from "@/lib/llm";

// Wissenssuche und KB-Antwort — gemeinsam genutzt vom Chat (app/api/chat) und
// vom Wissenstest im Dashboard (app/api/knowledge/test), damit der Test
// exakt so entscheidet und antwortet wie der echte Assistent.

export type RagMatch = {
  id: string;
  content: string;
  similarity: number;
};

export async function ragSearch(tenantId: string, query: string, k = 4): Promise<RagMatch[]> {
  const emb = await llm().embeddings.create({
    model: embeddingModel(),
    input: query,
  });
  const queryEmbedding = emb.data[0].embedding;
  const { data, error } = await supaAdmin.rpc("match_embeddings", {
    query_embedding: queryEmbedding,
    match_count: k,
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("match_embeddings error:", error);
    throw new Error("Vector search failed");
  }
  return (data ?? []) as RagMatch[];
}

export type MatchAssessment = {
  sorted: RagMatch[];
  /** Die Snippets, die als Unternehmenswissen an das Modell gehen. */
  top: RagMatch[];
  kbBullets: string;
  best: RagMatch | undefined;
  highConf: boolean;
  midConf: boolean;
  /** Bester Treffer reicht überhaupt für eine Wissensantwort. */
  goodEnough: boolean;
};

/** Bewertet Treffer mit den modellabhängigen Schwellen aus lib/llm.ts. */
export function assessMatches(matches: RagMatch[]): MatchAssessment {
  const t = ragThresholds();
  const sorted = (matches ?? [])
    .filter((m) => typeof m.similarity === "number" && !!m.content && m.content.trim().length > 0)
    .sort((a, b) => b.similarity - a.similarity);
  const above = sorted.filter((m) => m.similarity >= t.min);
  const top = (above.length > 0 ? above : sorted).slice(0, 4);
  const best = sorted[0];
  const second = sorted[1];
  const margin = best && second ? best.similarity - second.similarity : 0;
  const highConf = !!best && (best.similarity >= t.high || (best.similarity >= t.highAlt && margin >= t.margin));
  const midConf = !!best && best.similarity >= t.mid && !highConf;
  return {
    sorted,
    top,
    kbBullets: top.map((m) => `- ${m.content}`).join("\n"),
    best,
    highConf,
    midConf,
    goodEnough: !!best && best.similarity >= t.goodEnough,
  };
}

export function systemPrompt(companyName: string, fallbackMessage: string, safetyHint: string) {
  const now = new Date();
  const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const day = dayNames[now.getDay()];
  const date = now.toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: "Europe/Berlin",
  });
  const time = now.toLocaleTimeString("de-DE", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Berlin",
  });

  return `Rolle:
Du bist ein professioneller digitaler Assistent des Unternehmens "${companyName}".

AKTUELLES DATUM UND UHRZEIT:
- Heute ist ${day}, der ${date}
- Aktuelle Uhrzeit: ${time} Uhr (Europa/Berlin)
- Nutze diese Information wenn Fragen wie "heute", "jetzt", "gerade", "aktuell" gestellt werden.

REGELN:
- Antworte klar, höflich und direkt auf die Frage.
- Keine frei erfundenen Informationen.
- Wenn etwas nicht bekannt ist oder im Unternehmenswissen nicht vorkommt: Nutze sinngemäß: "${fallbackMessage}".
- Verwende kurze Absätze.
- Listen nur, wenn sinnvoll (max. 5–7 Punkte).
- Keine Begrüßung, kein Smalltalk, keine Abschlussfloskeln.

SICHERHEIT / KOMPLIANCE:
${safetyHint}

ZIEL:
Hilf der anfragenden Person schnell und zuverlässig mit Informationen des Unternehmens weiter.`;
}

/** Antwort aus dem Unternehmenswissen (Pfad „sichere Treffer" im Chat). */
export async function generateKbAnswer(params: {
  companyName: string;
  fallbackMessage: string;
  safetyHint: string;
  kbAnswerInstruction: string;
  kbBullets: string;
  pageHint?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}): Promise<string | null> {
  const completion = await llm().chat.completions.create({
    model: chatModel(),
    temperature: 0.35,
    messages: [
      { role: "system", content: systemPrompt(params.companyName, params.fallbackMessage, params.safetyHint) },
      {
        role: "user",
        content: `Verfügbares Unternehmenswissen:
${params.kbBullets}
${params.pageHint ?? ""}
WICHTIG:
${params.kbAnswerInstruction}`,
      },
      { role: "assistant", content: "Verstanden. Ich beantworte Fragen ausschließlich auf Basis dieser Informationen." },
      ...(params.history ?? []),
      { role: "user", content: params.message },
    ],
  });
  return completion.choices[0]?.message?.content ?? null;
}
