"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; text: string };

// Optional: Slug → Anzeigename (rein visuell)
const TENANT_LABELS: Record<string, string> = {
  "hausarzt-painten": "Arztpraxis",
  "muster-demo": "Beispielkunde",
};

function getTenantLabel(slug?: string) {
  if (!slug) return "Kunde";
  return TENANT_LABELS[slug] ?? "Kunde";
}

// Wrapper, damit TS nicht meckert
const Markdown = ReactMarkdown as any;

export default function DemoPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug;

  const tenantLabel = useMemo(() => getTenantLabel(slug), [slug]);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // immer nach unten scrollen bei neuen Messages
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  async function send(textOverride?: string) {
    const q = (textOverride ?? input).trim();
    if (!q || isSending) return;

    if (!slug) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Konfigurationsfehler: kein Tenant-Slug gesetzt." },
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
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie das Team direkt.",
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

  const quickChips = [
    { label: "Standardfragen automatisch beantworten", text: "Was kannst du grundsätzlich für mich tun?" },
    { label: "Anfragen strukturiert übergeben", text: "Wie läuft eine Anfrage strukturiert ab?" },
    { label: "Weniger Telefonaufkommen", text: "Wie entlastet der Assistent das Telefon?" },
  ];

  return (
    <main className="min-h-screen bg-[#f6f7f7] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        {/* Card */}
        <section className="rounded-[32px] bg-white/60 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur sm:p-10">
          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Live-Chat auf Ihrer Website
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Beispieldialog · Besucher: {tenantLabel}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Online · 24/7
            </div>
          </header>

          {/* Chat Area */}
          <div className="mt-8 space-y-6">
            {/* Chat bubbles container */}
            <div
              ref={scrollRef}
              className="space-y-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8"
              style={{ minHeight: 340 }}
            >
              {/* Demo-Intro (wenn noch keine Nachrichten) */}
              {messages.length === 0 && (
                <>
                  <div className="rounded-[22px] bg-white px-6 py-5 ring-1 ring-black/5">
                    <p className="text-[15px] leading-relaxed text-slate-900">
                      <span className="font-semibold">Patient:</span>{" "}
                      Kann ich online einen Termin vereinbaren und wie bestelle ich ein Rezept?
                    </p>
                  </div>

                  <div className="rounded-[22px] bg-white px-6 py-5 ring-1 ring-black/5">
                    <p className="text-[15px] leading-relaxed text-slate-900">
                      <span className="font-semibold">Praxis-Assistent:</span>{" "}
                      Sie können uns Ihre Terminanfrage rund um die Uhr über das Formular senden.
                      Wiederholungsrezepte können Sie bequem online bestellen – wir melden uns, sobald
                      sie abholbereit sind.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => send("Klingt perfekt. Wo finde ich das Formular?")}
                      className="max-w-[86%] rounded-full bg-[#0b0b0c] px-6 py-4 text-[15px] font-medium text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-95"
                    >
                      Klingt perfekt. Wo finde ich das Formular?
                    </button>
                  </div>

                  <div className="rounded-[22px] bg-white px-6 py-5 ring-1 ring-black/5">
                    <p className="text-[15px] leading-relaxed text-slate-900">
                      <span className="font-semibold">Praxis-Assistent:</span>{" "}
                      Ich öffne es Ihnen direkt hier – tragen Sie einfach kurz Ihre Daten ein, der
                      Rest läuft automatisch über Ihr Praxisteam.
                    </p>
                  </div>

                  <div className="pt-2" />
                </>
              )}

              {/* Real chat messages */}
              {messages.length > 0 && (
                <>
                  {messages.map((m, i) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={i} className={isUser ? "flex justify-end" : "flex justify-start"}>
                        <div
                          className={[
                            "max-w-[86%] rounded-[22px] px-6 py-5 text-[15px] leading-relaxed ring-1",
                            isUser
                              ? "bg-[#0b0b0c] text-white ring-black/10"
                              : "bg-white text-slate-900 ring-black/5",
                          ].join(" ")}
                        >
                          {isUser ? (
                            <span className="whitespace-pre-wrap">{m.text}</span>
                          ) : (
                            <div className="whitespace-pre-wrap">
                              <Markdown
                                components={{
                                  ul: ({ children }: any) => (
                                    <ul className="ml-5 list-disc space-y-2">{children}</ul>
                                  ),
                                  ol: ({ children }: any) => (
                                    <ol className="ml-5 list-decimal space-y-2">{children}</ol>
                                  ),
                                  li: ({ children }: any) => (
                                    <li className="leading-relaxed">{children}</li>
                                  ),
                                  p: ({ children }: any) => (
                                    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
                                  ),
                                }}
                              >
                                {m.text}
                              </Markdown>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* sending indicator */}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="rounded-[22px] bg-white px-6 py-5 text-[15px] text-slate-600 ring-1 ring-black/5">
                        Antwort wird erstellt…
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-3">
              {quickChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => send(c.text)}
                  className="rounded-full bg-white px-5 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:bg-slate-50"
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <form
                className="flex w-full items-center gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nachricht eingeben…"
                  className="h-12 w-full rounded-full bg-white px-5 text-sm text-slate-900 shadow-sm ring-1 ring-black/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />

                <button
                  type="submit"
                  disabled={isSending}
                  className="h-12 shrink-0 rounded-full bg-[#0b0b0c] px-6 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? "Senden…" : "Senden"}
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 pt-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Integration auf Ihrer bestehenden Website</span>
              <span>Fusionary AI – individuelle KI-Lösungen</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}