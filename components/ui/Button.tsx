import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium " +
  "transition-[color,background-color,border-color,transform] duration-150 ease-fluid " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-paper hover:bg-accent2",
  secondary: "border border-ink/20 bg-transparent text-ink hover:border-ink/40 hover:bg-ink/[0.03]",
  ghost: "bg-transparent text-ink2 hover:bg-ink/[0.05] hover:text-ink",
  danger: "border border-danger/30 bg-transparent text-danger hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[0.8125rem]",
  md: "h-10 px-5 text-sm",
};

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function buttonClass({ variant = "primary", size = "md", className }: Omit<Common, "children">) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: Common & ComponentProps<"button">) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />;
}
