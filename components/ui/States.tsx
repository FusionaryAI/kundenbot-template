import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Leerer Zustand, der den nächsten Schritt erklärt. Kein Icon-Kreis. */
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-flaeche border border-dashed px-6 py-10", className)}>
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-[56ch] text-sm leading-relaxed text-ink2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Platzhalterzeilen während des Ladens — ruhig, ohne Shimmer. */
export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y border-y", className)} aria-busy="true" aria-label="Wird geladen">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <div className="h-3 w-40 rounded-full bg-paper3" />
          <div className="h-3 flex-1 rounded-full bg-paper2" />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-element bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}
