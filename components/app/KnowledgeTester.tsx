"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { authedFetch } from "@/lib/api-client";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/States";

type Mode = "sicher" | "unsicher" | "keine" | "schutzregel";
type Source = { itemId: string | null; title: string | null; content: string; fit: "hoch" | "mittel" | "gering" };
type Result = { mode: Mode; answer: string; note: string | null; sources: Source[] };

const MODE: Record<Mode, { label: string; tone: BadgeTone }> = {
  sicher: { label: "Sichere Antwort", tone: "accent" },
  unsicher: { label: "Unsichere Antwort", tone: "warn" },
  keine: { label: "Kein passendes Wissen", tone: "warn" },
  schutzregel: { label: "Schutzregel greift", tone: "neutral" },
};

const FIT: Record<Source["fit"], string> = { hoch: "passt sehr gut", mittel: "passt", gering: "passt kaum" };

/**
 * „Assistent testen": Frage stellen, Antwort und Quellen sehen. Von hier aus
 * lässt sich ein falscher Eintrag korrigieren oder die richtige Antwort als
 * neuer Eintrag hinterlegen.
 */
export function KnowledgeTester({
  tenantId,
  onEditItem,
  onAddAnswer,
}: {
  tenantId: string;
  onEditItem: (itemId: string) => void;
  onAddAnswer: (question: string, answer: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function test(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError("");
    try {
      const res = await authedFetch("/api/knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, question: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("Zu viele Tests in kurzer Zeit. Bitte warten Sie einen Moment.");
      if (!res.ok || !data.ok) throw new Error("Der Test hat nicht geklappt. Bitte versuchen Sie es erneut.");
      setResult(data as Result);
      setAsked(q);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Der Test hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  const editable = result?.sources.filter((s) => s.itemId) ?? [];

  return (
    <section aria-labelledby="kb-test-title" className="rounded-flaeche border">
      <form onSubmit={test} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span id="kb-test-title" className="text-[0.9375rem] font-medium text-ink">
            Assistent testen
          </span>
          <span className="text-[0.8125rem] text-ink2">Stellen Sie eine Frage, wie sie ein Besucher stellen würde.</span>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="z. B. Kann ich bei Ihnen parken?"
            maxLength={500}
            className="mt-1.5"
          />
        </label>
        <Button type="submit" disabled={busy || question.trim().length < 2}>
          {busy ? "Assistent antwortet …" : "Testen"}
        </Button>
      </form>

      {error && (
        <div className="px-5 pb-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-5 border-t px-5 py-5" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={MODE[result.mode].tone}>{MODE[result.mode].label}</Badge>
            <span className="text-[0.8125rem] text-ink3">auf „{asked}“</span>
          </div>

          <div className="rounded-element bg-paper2 px-4 py-3 text-sm leading-relaxed text-ink [&_p+p]:mt-2 [&_strong]:font-medium [&_ul]:ml-4 [&_ul]:list-disc">
            <ReactMarkdown>{result.answer}</ReactMarkdown>
          </div>

          {result.note && <p className="text-[0.8125rem] leading-relaxed text-ink2">{result.note}</p>}

          {result.sources.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Gestützt auf</p>
              <ul className="divide-y border-y">
                {result.sources.map((s, i) => (
                  <li key={`${s.itemId ?? "x"}-${i}`} className="flex items-start gap-4 py-3">
                    <div className="min-w-0 flex-1 text-sm">
                      {s.title && <p className="font-medium text-ink">{s.title}</p>}
                      <p className="line-clamp-2 text-ink2">{s.content}</p>
                      <p className="mt-1 text-xs text-ink3">{FIT[s.fit]}</p>
                    </div>
                    {s.itemId && (
                      <button
                        type="button"
                        onClick={() => onEditItem(s.itemId!)}
                        className="shrink-0 text-[0.8125rem] font-medium text-accent hover:underline underline-offset-4"
                      >
                        Eintrag korrigieren
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => onAddAnswer(asked, result.mode === "sicher" || result.mode === "unsicher" ? result.answer : "")}>
              Richtige Antwort hinterlegen
            </Button>
            <span className="text-[0.8125rem] text-ink3">
              {editable.length > 0
                ? "Falsch? Korrigieren Sie den Eintrag oben — oder hinterlegen Sie die richtige Antwort als neuen."
                : "Hinterlegen Sie die Antwort, damit der Assistent sie künftig kennt."}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
