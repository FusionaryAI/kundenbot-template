"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; text: string };

// Slug → Unternehmensname (für interne Demos oder Kunden-Demos)
const TENANT_LABELS: Record<string, string> = {
  "hausarzt-painten": "Hausarztpraxis Painten",
  // weitere Kunden:
  // "kunde-muster": "Musterunternehmen GmbH",
};

function getCompanyName(slug?: string) {
  if (!slug) return "Ihr Unternehmen";
  return TENANT_LABELS[slug] ?? "Ihr Unternehmen";
}

// Wrapper, damit TS nicht rummeckert
const Markdown = ReactMarkdown as any;

export default function DemoPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug;
  const companyName = getCompanyName(slug);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || isSending) return;

    if (!slug) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            "Es liegt ein Konfigurationsfehler vor: kein Unternehmens-Slug gesetzt.",
        },
      ]);
      return;
    }

    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, message: q }),
      });

      if (!res.ok) throw new Error("Fehler bei der Anfrage.");

      const data = await res.json();
      const text = data.text ?? "Keine Antwort.";

      setMessages((m) => [...m, { role: "assistant", text }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich direkt an das Unternehmen.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:py-12">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Fusionary AI • Digitaler Assistent
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Ihr KI-gestützter Website-Assistent
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Beantwortet Kundenfragen, qualifiziert Anfragen und entlastet Ihr
              Team – individuell auf {companyName} und Ihre Website abgestimmt.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold shadow">
              AI
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm font-medium">Website-Assistent</span>
              <span className="text-xs text-emerald-600">Online</span>
            </div>
          </div>
        </header>

        {/* Layout: Chat links, Info rechts */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          {/* Chatfenster */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-slate-800">
                  Chat mit dem Assistenten
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Antworten in wenigen Sekunden
              </span>
            </div>

            <div className="flex h-[70vh] flex-col">
              {/* Nachrichten */}
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Stellen Sie eine Frage zu Leistungen, Angeboten,
                    Öffnungszeiten, Preisen oder Kontakt von {companyName}.
                  </p>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <div className="whitespace-pre-wrap leading-relaxed">
                          <Markdown
                            components={{
                              ul: ({ children }: any) => (
                                <ul className="ml-4 list-disc space-y-2">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }: any) => (
                                <ol className="ml-4 list-decimal space-y-2">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }: any) => (
                                <li className="ml-1 leading-relaxed">
                                  {children}
                                </li>
                              ),
                              p: ({ children }: any) => (
                                <p className="mb-2 leading-relaxed">
                                  {children}
                                </p>
                              ),
                            }}
                          >
                            {m.text}
                          </Markdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Eingabe */}
              <div className="border-t border-slate-200 px-4 py-3">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Frage eingeben…"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={isSending}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSending ? "Senden…" : "Senden"}
                  </button>
                </form>

                <p className="mt-1 text-[10px] text-right uppercase tracking-[0.2em] text-slate-400">
                  Powered by Fusionary AI
                </p>
              </div>
            </div>
          </section>

          {/* rechte Info-Spalte */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-800">
                Was kann dieser Assistent?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Der Assistent beantwortet Besucher- und Kundenfragen basierend
                auf Ihrer Website, Dokumenten und weiteren
                Unternehmensinformationen.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li>• Entlastet Ihr Team im Erstkontakt und Support</li>
                <li>• Einheitliche Antworten, rund um die Uhr</li>
                <li>• Individuell auf jedes Unternehmen trainierbar</li>
                <li>• Mehr qualifizierte und besser informierte Anfragen</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                Hinweis
              </h3>
              <p className="mt-2">
                Der Assistent ersetzt keine verbindliche Fachberatung. In
                wichtigen, rechtlich oder fachlich sensiblen Fällen sollten
                Kund:innen direkt Kontakt mit Ihrem Unternehmen aufnehmen.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                So läuft die Zusammenarbeit ab
              </h3>
              <ol className="ml-4 list-decimal space-y-1">
                <li>
                  Wir verbinden den Assistenten mit Ihrer Website und Ihren
                  Dokumenten.
                </li>
                <li>
                  Wir konfigurieren Tonalität, Sprachen und gewünschte Antworten.
                </li>
                <li>
                  Sie erhalten einen Einbettungscode für Ihre Website (z.&nbsp;B.
                  als Chat-Bubble unten rechts).
                </li>
                <li>
                  Auf Wunsch übernehmen wir laufende Pflege, Monitoring und
                  Optimierung.
                </li>
              </ol>
            </div>
          </aside>
        </div>

        {/* Unterer Info-Block */}
        <section className="mb-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <h2 className="text-sm font-semibold text-slate-900">
            Für welche Unternehmen eignet sich dieser Assistent?
          </h2>
          <p className="text-sm text-slate-600">
            Der Website-Assistent kann für nahezu jede Branche eingesetzt
            werden, zum Beispiel:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Dienstleister & Agenturen
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Arztpraxen & Gesundheitsanbieter
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Steuerberater & Kanzleien
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Handwerk & lokale Betriebe
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Coaches & Berater:innen
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Immobilien & Bildungsanbieter
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
