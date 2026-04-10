"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase setzt die Session automatisch wenn der Reset-Link geklickt wird
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      setMsg("Passwörter stimmen nicht überein.");
      return;
    }

    if (password.length < 8) {
      setMsg("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setLoading(true);
    setMsg("");

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setMsg("Fehler beim Zurücksetzen. Bitte nochmal versuchen.");
    } else {
      setMsg("Passwort erfolgreich geändert!");
      setTimeout(() => router.push("/dashboard"), 2000);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl p-8 border border-white/10">
        <h1 className="text-white text-2xl font-semibold mb-2">Fusionary AI</h1>
        <p className="text-zinc-400 text-sm mb-6">Gib dein neues Passwort ein.</p>

        {!ready ? (
          <div className="text-zinc-400 text-sm text-center py-4">
            <p>Link wird überprüft...</p>
            <p className="text-xs mt-2 text-zinc-600">
              Falls diese Seite hängt, klicke den Link in der E-Mail nochmal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Neues Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mindestens 8 Zeichen"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Passwort bestätigen</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Passwort wiederholen"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            {msg && (
              <p className={`text-xs ${msg.includes("Fehler") || msg.includes("nicht") ? "text-red-400" : "text-green-400"}`}>
                {msg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {loading ? "Wird gespeichert..." : "Passwort ändern"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}