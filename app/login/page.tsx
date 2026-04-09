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

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl p-8 border border-white/10">
        <h1 className="text-white text-2xl font-semibold mb-2">Fusionary AI</h1>
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
        </form>
      </div>
    </main>
  );
}