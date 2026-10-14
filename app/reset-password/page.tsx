"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { startBrowserSession } from "@/lib/session-guard";
import { AuthCard } from "@/components/app/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/States";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Der Link aus der E-Mail setzt eine Wiederherstellungs-Session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Das Passwort braucht mindestens 8 Zeichen.");
    if (password !== confirm) return setError("Die beiden Passwörter stimmen nicht überein.");
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError("Das hat nicht geklappt. Bitte fordern Sie einen neuen Link an.");
    startBrowserSession();
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <AuthCard eyebrow="Kundenbereich" title="Neues Passwort" description="Mindestens 8 Zeichen.">
      {done ? (
        <p role="status" className="rounded-element bg-accent-soft px-4 py-3 text-sm text-accent">
          Passwort geändert. Sie werden weitergeleitet …
        </p>
      ) : !ready ? (
        <div className="flex flex-col gap-4 text-sm text-ink2">
          <p>Der Link wird geprüft. Wenn nichts passiert, ist er abgelaufen oder wurde bereits verwendet.</p>
          <Link href="/login" className="text-[0.8125rem] underline underline-offset-4 hover:text-ink">
            Neuen Link anfordern
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Field label="Neues Passwort" htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Wiederholen" htmlFor="confirm">
            <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Wird gespeichert …" : "Passwort speichern"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
