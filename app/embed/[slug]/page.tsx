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

/** Minimaler Inline-Iconsatz (ohne externe Lib) */
function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 7l10 10M17 7L7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSend(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3.5 11.5l16.2-7.2c.7-.3 1.4.4 1.1 1.1l-7.2 16.2c-.3.8-1.5.7-1.7-.1l-1.5-5.4-5.4-1.5c-.8-.2-.9-1.4-.1-1.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.9 13.1l4.7-4.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSpark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2l1.6 6.1L20 10l-6.4 1.9L12 18l-1.6-6.1L4 10l6.4-1.9L12 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPhone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6.5 3.9l2.2-.7c.6-.2 1.2.1 1.4.7l1 2.7c.2.5 0 1.1-.4 1.4l-1.3 1c1.1 2.3 2.9 4.1 5.2 5.2l1-1.3c.3-.4.9-.6 1.4-.4l2.7 1c.6.2.9.8.7 1.4l-.7 2.2c-.2.7-.9 1.1-1.6 1-7.6-1.3-13.5-7.2-14.8-14.8-.1-.7.3-1.4 1-1.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 7v6l4 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** Universeller KI-Avatar (Option B: leicht warm) */
function AssistantAvatar({ size = 44 }: { size?: number }) {
  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Outer ring / glass */}
      <div className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15" />
      {/* Gradient core */}
      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-indigo-200/70 via-violet-200/50 to-amber-100/40 blur-[0.2px]" />
      {/* Glow */}
      <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-indigo-400/25 via-violet-400/15 to-amber-300/10 blur-2xl" />
      {/* Specular highlight */}
      <div className="absolute left-2 top-2 h-1/3 w-1/3 rounded-full bg-white/35 blur-[1px]" />
      {/* Center dot */}
      <div className="absolute h-2.5 w-2.5 rounded-full bg-white/70 shadow-[0_0_20px_rgba(255,255,255,0.35)]" />
      {/* Gentle pulse (subtle) */}
      <div className="absolute inset-0 rounded-full animate-[pulse_6s_ease-in-out_infinite] bg-white/5" />
    </div>
  );
}

export default function Embed({ params }: EmbedProps) {
  const slug = params.slug;
  const tenantLabel = useMemo(() => getTenantLabel(slug), [slug]);

  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

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

  // Optional: Höhe an Parent melden
  useEffect(() => {
    const h = scrollRef.current?.scrollHeight ?? 560;
    try {
      window.parent.postMessage({ type: "__widget_height__", height: h }, "*");
    } catch {
      // egal
    }
  }, [messages, isOpen]);

  const quickActions = [
    {
      label: "Was kann der Assistent?",
      text: "Was kannst du grundsätzlich für mich tun?",
      icon: <IconSpark className="h-4 w-4" />,
    },
    {
      label: "Kontakt aufnehmen",
      text: "Wie kann ich euch kontaktieren?",
      icon: <IconPhone className="h-4 w-4" />,
    },
    {
      label: "Öffnungszeiten",
      text: "Wie sind die Öffnungszeiten?",
      icon: <IconClock className="h-4 w-4" />,
    },
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
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#0b0b0c] px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/10 hover:opacity-95"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
            Chat öffnen
          </button>
        )}

        {isOpen && (
          <section className="w-[380px] max-w-[92vw] overflow-hidden rounded-[28px] bg-white/75 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur-xl">
            {/* Header (Glass + Dark) */}
            <header className="relative overflow-hidden px-5 py-4">
              {/* Dark glass background */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0c]/95 to-[#0b0b0c]/70" />
              {/* subtle highlight */}
              <div className="absolute -top-24 left-10 h-48 w-48 rounded-full bg-gradient-to-tr from-indigo-400/18 via-violet-400/10 to-amber-300/8 blur-3xl" />
              <div className="relative flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <AssistantAvatar size={46} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold tracking-tight text-white">
                      Digitaler Assistent
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/70">
                      <span className="truncate">{tenantLabel}</span>
                      <span className="text-white/35">•</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" />
                        Online · 24/7 verfügbar
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70 ring-1 ring-white/15 hover:bg-white/15 hover:text-white"
                  aria-label="Schließen"
                  title="Schließen"
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Body */}
            <div className="px-4 pb-4 pt-4">
              {/* Messages */}
              <div
                ref={scrollRef}
                className="h-[380px] space-y-4 overflow-y-auto rounded-[22px] bg-white/80 p-4 ring-1 ring-black/5 backdrop-blur"
              >
                {messages.map((m, i) => {
                  const isUser = m.role === "user";

                  return (
                    <div key={i} className={isUser ? "flex justify-end" : "flex justify-start gap-2"}>
                      {!isUser && (
                        <div className="mt-0.5 shrink-0">
                          <AssistantAvatar size={28} />
                        </div>
                      )}

                      <div
                        className={[
                          "max-w-[86%] rounded-[18px] px-4 py-3 text-[14px] leading-relaxed ring-1",
                          isUser
                            ? "bg-[#0b0b0c] text-white ring-black/10 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                            : "bg-white text-slate-900 ring-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
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
                  <div className="flex justify-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      <AssistantAvatar size={28} />
                    </div>
                    <div className="rounded-[18px] bg-white px-4 py-3 text-[14px] text-slate-600 ring-1 ring-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex gap-1">
                          <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-slate-400" />
                          <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_0.2s_infinite] rounded-full bg-slate-400" />
                          <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_0.4s_infinite] rounded-full bg-slate-400" />
                        </span>
                        Antwort wird erstellt…
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested questions */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium tracking-wide text-slate-500">
                  Empfohlene Fragen
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => send(a.text)}
                      className="group flex items-center gap-2 rounded-[18px] bg-white/85 px-3 py-3 text-left text-sm text-slate-800 ring-1 ring-black/5 shadow-[0_10px_26px_rgba(0,0,0,0.08)] backdrop-blur transition
                                 hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.10)]
                                 active:translate-y-0"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-black/5 group-hover:bg-slate-50">
                        {a.icon}
                      </span>
                      <span className="line-clamp-2 leading-snug">{a.label}</span>
                    </button>
                  ))}

                  {/* Optional: in 2-col grid bleibt eine Karte übrig → wir lassen’s so, wirkt modern */}
                </div>
              </div>

              {/* Input */}
              <form
                className="mt-4 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <div className="flex h-12 w-full items-center rounded-full bg-white/85 px-4 ring-1 ring-black/10 shadow-[0_12px_30px_rgba(0,0,0,0.10)] backdrop-blur focus-within:ring-2 focus-within:ring-emerald-200">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nachricht eingeben…"
                    className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="grid h-12 w-12 place-items-center rounded-full bg-[#0b0b0c] text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/10 hover:opacity-95 disabled:opacity-60"
                  aria-label="Senden"
                  title="Senden"
                >
                  <IconSend className="h-5 w-5" />
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