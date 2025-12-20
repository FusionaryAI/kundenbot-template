"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type EmbedProps = {
  params: { slug: string };
};

// rein visuell (optional)
const TENANT_LABELS: Record<string, string> = {
  "hausarzt-painten": "Arztpraxis",
  "muster-demo": "Beispielkunde",
};

function getTenantLabel(slug?: string) {
  if (!slug) return "Kunde";
  return TENANT_LABELS[slug] ?? "Kunde";
}

const Markdown = ReactMarkdown as any;

export default function Embed({ params }: EmbedProps) {
  // Slug kommt aus der Route /embed/[slug]
  const slug = params.slug;

  const tenantLabel = useMemo(() => getTenantLabel(slug), [slug]);

  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Begrüßung (nur UI)
  const welcomeText =
    "Hallo! Ich bin der digitale Assistent. Stellen Sie mir Ihre Frage – ich helfe Ihnen sofort weiter.";

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: welcomeText },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending, isOpen]);

  async function send(textOverride?: string) {
    const q = (textOverride ?? input).trim();
    if (!q || isSending) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, message: q }),
      });

      const data = await res.json();
      const answer =
        typeof data?.text === "string"
          ? data.text
          : "Entschuldigung, ich konnte gerade keine Antwort erzeugen.";

      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Technischer Fehler: Die Anfrage konnte nicht verarbeitet werden.",
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

  // Optional: Höhe an Parent melden (dein bestehendes Verhalten)
  useEffect(() => {
    const h = scrollRef.current?.scrollHeight ?? 560;
    try {
      window.parent.postMessage({ type: "__widget_height__", height: h }, "*");
    } catch {
      // egal
    }
  }, [messages, isOpen]);

  const quickChips = [
    { label: "Was kannst du?", text: "Was kannst du grundsätzlich für mich tun?" },
    { label: "Kontakt", text: "Wie kann ich euch kontaktieren?" },
    { label: "Öffnungszeiten", text: "Wie sind die Öffnungszeiten?" },
  ];

  return (
    <main className="h-screen w-screen bg-transparent">
      {/* Container im iFrame */}
      <div className="fixed bottom-0 right-0 p-4">
        {/* Closed launcher */}
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-full bg-[#0b0b0c] px-5 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-black/10 hover:opacity-95"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Chat öffnen
          </button>
        )}

        {isOpen && (
          <section className="w-[360px] max-w-[92vw] overflow-hidden rounded-[28px] bg-white/80 shadow-xl ring-1 ring-black/10 backdrop-blur">
            {/* Header */}
            <header className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-tight text-slate-900">
                  Digitaler Assistent
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {tenantLabel} · Online
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  24/7
                </span>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                  aria-label="Minimieren"
                  title="Minimieren"
                >
                  —
                </button>
              </div>
            </header>

            {/* Chat content */}
            <div className="px-4 pb-4">
              <div
                ref={scrollRef}
                className="h-[380px] space-y-4 overflow-y-auto rounded-[22px] bg-white p-4 ring-1 ring-black/5"
              >
                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={i} className={isUser ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={[
                          "max-w-[86%] rounded-[20px] px-4 py-3 text-[14px] leading-relaxed ring-1",
                          isUser
                            ? "bg-[#0b0b0c] text-white ring-black/10"
                            : "bg-white text-slate-900 ring-black/5",
                        ].join(" ")}
                      >
                        {isUser ? (
                          <span className="whitespace-pre-wrap">{m.text}</span>
                        ) : (
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
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-[20px] bg-white px-4 py-3 text-[14px] text-slate-600 ring-1 ring-black/5">
                      Antwort wird erstellt…
                    </div>
                  </div>
                )}
              </div>

              {/* Chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {quickChips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => send(c.text)}
                    className="rounded-full bg-white px-3 py-2 text-xs text-slate-700 shadow-sm ring-1 ring-black/5 hover:bg-slate-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <form
                className="mt-3 flex items-center gap-2"
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
                  className="h-11 w-full rounded-full bg-white px-4 text-sm shadow-sm ring-1 ring-black/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <button
                  type="submit"
                  disabled={isSending}
                  className="h-11 rounded-full bg-[#0b0b0c] px-4 text-sm font-medium text-white shadow-sm ring-1 ring-black/10 hover:opacity-95 disabled:opacity-60"
                >
                  Senden
                </button>
              </form>

              <div className="mt-2 text-right text-[10px] tracking-wide text-slate-400">
                Powered by Fusionary AI
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}