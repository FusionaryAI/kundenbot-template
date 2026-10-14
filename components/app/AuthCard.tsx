import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

/** Rahmen für Anmeldung und Passwort-Reset. */
export function AuthCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-paper px-5 py-8 sm:px-8">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[24rem]">
          <p className="eyebrow mb-3 text-accent">{eyebrow}</p>
          <h1 className="font-display text-[2.25rem] text-ink">{title}</h1>
          {description && <p className="mt-3 text-sm leading-relaxed text-ink2">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <p className="text-xs text-ink3">
        Fusionary AI ·{" "}
        <a href="https://fusionaryai.de/datenschutz" className="underline underline-offset-4 hover:text-ink">
          Datenschutz
        </a>{" "}
        ·{" "}
        <a href="https://fusionaryai.de/impressum" className="underline underline-offset-4 hover:text-ink">
          Impressum
        </a>
      </p>
    </main>
  );
}
