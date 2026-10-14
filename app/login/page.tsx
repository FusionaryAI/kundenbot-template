"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { startBrowserSession } from "@/lib/session-guard";
import { AuthCard } from "@/components/app/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/States";

const ENDED: Record<string, string> = {
  inaktiv: "Sie wurden nach 60 Minuten ohne Aktivität abgemeldet. Bitte melden Sie sich erneut an.",
  browser: "Ihre Sitzung endet, wenn der Browser geschlossen wird. Bitte melden Sie sich erneut an.",
};

function LoginForm() {
  const router = useRouter();
  const endedReason = useSearchParams().get("abgemeldet");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Anmeldung fehlgeschlagen. Bitte prüfen Sie E-Mail und Passwort.");
      setBusy(false);
      return;
    }
    startBrowserSession();
    router.push("/dashboard");
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    // Immer dieselbe Rückmeldung — verrät nicht, ob ein Konto existiert.
    setResetSent(true);
    setBusy(false);
  }

  if (mode === "reset") {
    return (
      <AuthCard
        eyebrow="Kundenbereich"
        title="Passwort vergessen"
        description="Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen."
      >
        {resetSent ? (
          <p role="status" className="rounded-element bg-accent-soft px-4 py-3 text-sm text-accent">
            Falls ein Konto zu {email} existiert, ist die E-Mail unterwegs. Bitte prüfen Sie auch den Spam-Ordner.
          </p>
        ) : (
          <form onSubmit={requestReset} className="flex flex-col gap-5">
            <Field label="E-Mail" htmlFor="email">
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Wird gesendet …" : "Link senden"}
            </Button>
          </form>
        )}
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setResetSent(false);
          }}
          className="mt-6 text-[0.8125rem] text-ink2 underline-offset-4 hover:text-ink hover:underline"
        >
          Zurück zur Anmeldung
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard eyebrow="Kundenbereich" title="Anmelden" description="Ihr Assistent, Ihre Anfragen und was er für Sie bewirkt.">
      {endedReason && ENDED[endedReason] && (
        <p role="status" className="mb-6 rounded-element bg-paper2 px-4 py-3 text-sm text-ink2">
          {ENDED[endedReason]}
        </p>
      )}
      <form onSubmit={login} className="flex flex-col gap-5">
        <Field label="E-Mail" htmlFor="email">
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Passwort" htmlFor="password">
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Wird angemeldet …" : "Anmelden"}
        </Button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode("reset");
          setError("");
        }}
        className="mt-6 text-[0.8125rem] text-ink2 underline-offset-4 hover:text-ink hover:underline"
      >
        Passwort vergessen?
      </button>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
