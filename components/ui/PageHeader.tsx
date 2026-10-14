import type { ReactNode } from "react";

/**
 * Seitenkopf: einziger Ort, an dem Newsreader im Produkt erscheint.
 * Darunter eine Haarlinie; Aktionen rechtsbündig.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b pb-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Abschnitt innerhalb einer Seite: kleine Überschrift, optionale Aktion. */
export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[0.9375rem] font-medium text-ink">{title}</h2>
          {hint && <span className="text-[0.8125rem] text-ink3">{hint}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
