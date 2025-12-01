"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type EmbedProps = {
  params: { slug: string };
};

export default function Embed({ params }: EmbedProps) {
  // Slug kommt immer aus der Route /embed/[slug]
  const slug = params.slug;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hallo! Wie kann ich Ihnen helfen?" },
  ]);

  const boxRef = useRef<HTMLDivElement | null>(null);

  async function send() {
    const q = input.trim();
    if (!q) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);

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
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            "Technischer Fehler: Die Anfrage konnte nicht verarbeitet werden.",
        },
      ]);
    }
  }

  // Höhe an den Parent (Widget) melden – optional, schadet aber nicht
  useEffect(() => {
    const h = boxRef.current?.scrollHeight ?? 500;
    try {
      window.parent.postMessage(
        { type: "__widget_height__", height: h },
        "*",
      );
    } catch {
      // egal, wenn es fehlschlägt
    }
  }, [messages]);

  return (
    <div className="min-h-[420px] w-[360px] max-w-full bg-white text-gray-900 flex flex-col rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
      {/* Kopfzeile im iFrame */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold">
        Praxis-Assistent
      </div>

      {/* Chatbereich */}
      <div
        ref={boxRef}
        className="flex-1 p-3 space-y-3 overflow-y-auto bg-white"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={`inline-block px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Eingabebereich */}
      <div className="p-2 flex gap-2 border-t border-gray-200 bg-gray-50">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Frage eingeben…"
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={send}
          className="rounded-xl bg-blue-600 text-white px-4 text-sm font-semibold hover:bg-blue-700 transition"
        >
          Senden
        </button>
      </div>
    </div>
  );
}
