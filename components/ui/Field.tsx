import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-element border bg-paper px-3 text-sm text-ink placeholder:text-ink3 " +
  "transition-colors duration-150 hover:border-ink/25 focus:border-accent focus:outline-none " +
  "focus-visible:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-paper2 disabled:text-ink3";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cn(control, "h-10 pr-8", className)} {...rest} />;
}

/** Beschriftetes Feld mit optionalem Hinweis/Fehler darunter. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium text-ink2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.8125rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-ink3">{hint}</p>
      ) : null}
    </div>
  );
}
