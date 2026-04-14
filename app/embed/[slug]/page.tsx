// deploy-test
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  text: string;
  isTyping?: boolean;
};

type EmbedProps = {
  params: { slug: string };
};

const TENANT_LABELS: Record<string, string> = {
  "hausarzt-painten": "Arztpraxis",
  "muster-demo": "Beispielkunde",
};

function getTenantLabel(slug?: string) {
  if (!slug) return "Kunde";
  return TENANT_LABELS[slug] ?? "Kunde";
}

const Markdown = ReactMarkdown as any;

function slugFromPathname(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/\/embed\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function useTypewriter(text: string, enabled: boolean, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, enabled, speed]);

  return { displayed, done };
}

function AssistantMessage({ text, animate }: { text: string; animate: boolean }) {
  const { displayed } = useTypewriter(text, animate, 12);

  return (
    <Markdown
      components={{
        ul: ({ children }: any) => <ul style={{ marginLeft: "16px", listStyleType: "disc" }}>{children}</ul>,
        ol: ({ children }: any) => <ol style={{ marginLeft: "16px", listStyleType: "decimal" }}>{children}</ol>,
        li: ({ children }: any) => <li style={{ lineHeight: 1.6 }}>{children}</li>,
        p: ({ children }: any) => <p style={{ marginBottom: "6px" }}>{children}</p>,
      }}
    >
      {displayed || " "}
    </Markdown>
  );
}

export default function Embed({ params }: EmbedProps) {
  const [slugSafe, setSlugSafe] = useState<string>(() => params?.slug || "");
  useEffect(() => {
    const s = params?.slug || slugFromPathname() || "";
    setSlugSafe(s);
  }, [params?.slug]);

  const tenantLabel = useMemo(() => getTenantLabel(slugSafe), [slugSafe]);

  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [lastAssistantIndex, setLastAssistantIndex] = useState(-1);
  const [tenantName, setTenantName] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    async function loadWelcome() {
      const slug = params?.slug || slugFromPathname() || "";
      if (!slug || welcomeLoaded) return;

      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${origin}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": slug,
          },
          body: JSON.stringify({ slug, message: "Hallo" }),
        });
        const data = await res.json().catch(() => ({}));
        const welcome = data?.welcome_message?.trim();
        if (data?.tenant_name) setTenantName(data.tenant_name);
        setMessages([{
          role: "assistant",
          text: welcome || "Hallo! Wie kann ich Ihnen helfen?",
          isTyping: true,
        }]);
        setLastAssistantIndex(0);
      } catch {
        setMessages([{
          role: "assistant",
          text: "Hallo! Wie kann ich Ihnen helfen?",
          isTyping: true,
        }]);
        setLastAssistantIndex(0);
      }
      setWelcomeLoaded(true);
    }
    loadWelcome();
  }, [params?.slug, welcomeLoaded]);

  async function send(textOverride?: string) {
    const q = (textOverride ?? input).trim();
    if (!q || isSending) return;

    const slug = slugSafe || slugFromPathname() || "";
    if (!slug) {
      setMessages((m) => [
        ...m,
        { role: "user", text: q },
        { role: "assistant", text: "Konfigurationsfehler: Tenant-Slug fehlt.", isTyping: false },
      ]);
      setInput("");
      return;
    }

    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setIsSending(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const apiUrl = `${origin}/api/chat`;
      const debug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("debug") : null;
      const finalUrl = debug === "1" ? `${apiUrl}?debug=1` : apiUrl;

      const res = await fetch(finalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": slug,
        },
        body: JSON.stringify({
          slug,
          message: q,
          messages: messages
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = typeof data?.error === "string" && data.error.trim()
          ? data.error
          : "API Fehler: Anfrage fehlgeschlagen.";
        setMessages((m) => {
          const next = [...m, { role: "assistant" as const, text: errMsg, isTyping: false }];
          setLastAssistantIndex(next.length - 1);
          return next;
        });
        return;
      }

      const answer =
        typeof data?.text === "string" && data.text.trim().length > 0
          ? data.text
          : "Entschuldigung, ich konnte gerade keine Antwort erzeugen.";

      setMessages((m) => {
        const next = [...m, { role: "assistant" as const, text: answer, isTyping: true }];
        setLastAssistantIndex(next.length - 1);
        return next;
      });
    } catch {
      setMessages((m) => {
        const next = [...m, { role: "assistant" as const, text: "Technischer Fehler: Die Anfrage konnte nicht verarbeitet werden.", isTyping: false }];
        setLastAssistantIndex(next.length - 1);
        return next;
      });
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

  const quickActions = [
    { label: "Was kann der Assistent?", text: "Was kannst du grundsätzlich für mich tun?" },
    { label: "Kontakt aufnehmen", text: "Wie kann ich euch kontaktieren?" },
    { label: "Öffnungszeiten", text: "Wie sind die Öffnungszeiten?" },
  ];

  return (
    <main style={{ height: "100%", width: "100%", background: "transparent" }}>
      <div style={{ height: "100%", width: "100%", padding: "12px", boxSizing: "border-box" }}>

        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "100px",
              background: "#1a5c3a",
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff", display: "inline-block" }} />
            Chat öffnen
          </button>
        )}

        {isOpen && (
          <div style={{
            height: "100%",
            width: "380px",
            maxWidth: "92vw",
            display: "flex",
            flexDirection: "column",
            borderRadius: "24px",
            background: "#fff",
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
            border: "1px solid rgba(0,0,0,0.07)",
            overflow: "hidden",
          }}>

            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fff",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#f0fdf4",
                  border: "1px solid #d1fae5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#0a0a0a", letterSpacing: "-0.2px" }}>
                    KI-Assistent
                  </p>
                  <p style={{ fontSize: "11px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    Online · {tenantName || "Kundenservice"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#f5f5f5",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888",
                  fontSize: "16px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                minHeight: 0,
                background: "#fff",
                scrollBehavior: "smooth",
              }}
            >
              {messages.length === 0 && (
                <div style={{
                  alignSelf: "flex-start",
                  background: "#f9fafb",
                  border: "1px solid #f0f0f0",
                  borderRadius: "18px",
                  padding: "12px 16px",
                  display: "flex",
                  gap: "4px",
                  alignItems: "center",
                }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span
                      key={i}
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#ccc",
                        display: "inline-block",
                        animation: `bounce 1.2s ${delay}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}

              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const shouldAnimate = !isUser && i === lastAssistantIndex && m.isTyping === true;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      animation: "fadeSlideIn 0.25s ease forwards",
                    }}
                  >
                    <div style={{
                      maxWidth: "86%",
                      borderRadius: "18px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      background: isUser ? "#1a5c3a" : "#f9fafb",
                      color: isUser ? "#fff" : "#1a1a1a",
                      border: isUser ? "none" : "1px solid #f0f0f0",
                    }}>
                      {isUser ? (
                        <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                      ) : (
                        <AssistantMessage text={m.text} animate={shouldAnimate} />
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div style={{
                  display: "flex",
                  justifyContent: "flex-start",
                  animation: "fadeSlideIn 0.25s ease forwards",
                }}>
                  <div style={{
                    background: "#f9fafb",
                    border: "1px solid #f0f0f0",
                    borderRadius: "18px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                  }}>
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <span
                        key={i}
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#ccc",
                          display: "inline-block",
                          animation: `bounce 1.2s ${delay}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                40% { transform: translateY(-5px); opacity: 1; }
              }
              @keyframes fadeSlideIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* Quick Actions */}
            <div style={{
              padding: "10px 16px 0",
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              flexShrink: 0,
              background: "#fff",
            }}>
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => send(a.text)}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #efefef",
                    borderRadius: "100px",
                    padding: "6px 12px",
                    fontSize: "11.5px",
                    color: "#555",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0fdf4";
                    e.currentTarget.style.borderColor = "#d1fae5";
                    e.currentTarget.style.color = "#065f46";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f9fafb";
                    e.currentTarget.style.borderColor = "#efefef";
                    e.currentTarget.style.color = "#555";
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{
              padding: "12px 16px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexShrink: 0,
              background: "#fff",
            }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nachricht eingeben…"
                style={{
                  flex: 1,
                  height: "40px",
                  borderRadius: "100px",
                  background: "#f5f5f5",
                  border: "1px solid #efefef",
                  padding: "0 16px",
                  fontSize: "13px",
                  color: "#111",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#10b981"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#efefef"}
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={isSending}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#1a5c3a",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  opacity: isSending ? 0.6 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M3.5 11.5l16.2-7.2c.7-.3 1.4.4 1.1 1.1l-7.2 16.2c-.3.8-1.5.7-1.7-.1l-1.5-5.4-5.4-1.5c-.8-.2-.9-1.4-.1-1.7Z"/>
                </svg>
              </button>
            </div>

            <div style={{ textAlign: "center", fontSize: "10px", color: "#ccc", paddingBottom: "10px" }}>
              Powered by Fusionary AI
            </div>

          </div>
        )}
      </div>
    </main>
  );
}