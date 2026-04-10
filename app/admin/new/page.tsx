"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewTenantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("Hallo! Wie kann ich Ihnen helfen?");
  const [fallbackMsg, setFallbackMsg] = useState("Dazu habe ich leider keine Informationen. Soll ich Ihre Anfrage ans Team weiterleiten?");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadAutoReply, setLeadAutoReply] = useState("Vielen Dank! Wir melden uns zeitnah.");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit() {
    if (!name || !slug || !leadEmail || !clientEmail || !clientPassword) {
      setMsg("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    setSaving(true);
    setMsg("");

    const res = await fetch("/api/admin/create-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        welcome_message: welcomeMsg,
        fallback_message: fallbackMsg,
        lead_email: leadEmail,
        lead_auto_reply: leadAutoReply,
        client_email: clientEmail,
        client_password: clientPassword,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.ok) {
      router.push(`/admin/${slug}`);
    } else {
      setMsg(`Fehler: ${data.error}`);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            ← Alle Kunden
          </button>
          <span className="text-zinc-600">|</span>
          <span className="text-white font-medium">Neuen Kunden anlegen</span>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
          className="text-zinc-400 text-sm hover:text-white transition"
        >
          Abmelden
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Tenant Info */}
        <section>
          <h2 className="text-base font-medium mb-4">Kundeninformationen</h2>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 flex flex-col gap-4">

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">
                Name des Unternehmens <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(generateSlug(e.target.value));
                }}
                placeholder="z.B. Hausarztpraxis Mustermann"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">
                Slug (URL-Kürzel) <span className="text-red-400">*</span>
              </label>
              <input
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                placeholder="z.B. hausarzt-mustermann"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
              <p className="text-zinc-600 text-xs mt-1">
                Bot-URL: /embed/{slug || "..."}
              </p>
            </div>

          </div>
        </section>

        {/* Bot Einstellungen */}
        <section>
          <h2 className="text-base font-medium mb-4">Bot-Einstellungen</h2>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 flex flex-col gap-4">

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Willkommensnachricht</label>
              <input
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Fallback-Nachricht</label>
              <input
                value={fallbackMsg}
                onChange={(e) => setFallbackMsg(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">
                Lead-E-Mail <span className="text-red-400">*</span>
              </label>
              <input
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="kunde@beispiel.de"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Auto-Reply nach Lead</label>
              <input
                value={leadAutoReply}
                onChange={(e) => setLeadAutoReply(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

          </div>
        </section>

        {/* Kunden-Login */}
        <section>
          <h2 className="text-base font-medium mb-4">Dashboard-Zugang für Kunden</h2>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 flex flex-col gap-4">

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">
                E-Mail des Kunden <span className="text-red-400">*</span>
              </label>
              <input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="kunde@beispiel.de"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">
                Passwort <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

          </div>
        </section>

        {/* Speichern */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-white text-black font-medium rounded-lg px-6 py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {saving ? "Wird angelegt..." : "Kunden anlegen"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.includes("Fehler") ? "text-red-400" : "text-green-400"}`}>
              {msg}
            </span>
          )}
        </div>

      </div>
    </main>
  );
}