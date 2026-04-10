"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Passwort vergessen
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `https://dashboard.fusionaryai.de/reset-password`,
    });

    setResetLoading(false);

    if (error) {
      setResetMsg("Fehler beim Senden. Bitte E-Mail prüfen.");
    } else {
      setResetMsg("E-Mail gesendet! Prüfe deinen Posteingang.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl p-8 border border-white/10">
        <h1 className="text-white text-2xl font-semibold mb-2">Fusionary AI</h1>

        {!showReset ? (
          <>
            <p className="text-zinc-400 text-sm mb-6">Melde dich an um fortzufahren.</p>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="deine@email.de"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Passwort</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {loading ? "Wird angemeldet..." : "Anmelden"}
              </button>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-zinc-500 text-xs hover:text-zinc-300 transition text-center"
              >
                Passwort vergessen?
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-zinc-400 text-sm mb-6">
              Gib deine E-Mail ein – wir senden dir einen Link zum Zurücksetzen.
            </p>
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">E-Mail</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="deine@email.de"
                />
              </div>
              {resetMsg && (
                <p className={`text-xs ${resetMsg.includes("Fehler") ? "text-red-400" : "text-green-400"}`}>
                  {resetMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-white text-black font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {resetLoading ? "Wird gesendet..." : "Reset-Link senden"}
              </button>
              <button
                type="button"
                onClick={() => { setShowReset(false); setResetMsg(""); }}
                className="text-zinc-500 text-xs hover:text-zinc-300 transition text-center"
              >
                Zurück zum Login
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}