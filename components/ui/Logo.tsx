import { cn } from "@/lib/cn";
import { LOGO_PATH } from "@/lib/logo";

/** Wortmarke „Fusionary AI" wie auf fusionaryai.de (components/ui/Logo.tsx). */
export function Logo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap font-serif text-[1.2rem] leading-none tracking-tight text-ink",
        className,
      )}
    >
      <svg
        viewBox="237 271 534 460"
        role="img"
        aria-label="Fusionary AI"
        className="shrink-0 text-accent"
        style={{ height: "1.4em", width: "auto" }}
      >
        <path fill="currentColor" d={LOGO_PATH} />
      </svg>
      {!markOnly && (
        <span>
          Fusionary&nbsp;<em className="not-italic text-accent">AI</em>
        </span>
      )}
    </span>
  );
}
