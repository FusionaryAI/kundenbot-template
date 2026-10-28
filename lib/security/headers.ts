// Security-Header für next.config.ts (SECURITY.md: CSP, nosniff, Referrer-
// und Permissions-Policy). Eigene Datei, damit die Regeln testbar sind.
//
// Zwei Bereiche mit unterschiedlicher Einbettung:
// - /embed/* läuft per iframe auf Kundenseiten → frame-ancestors *.
// - alles andere (Dashboard, Admin, Login) darf nirgends eingebettet werden
//   (Clickjacking); dort liegt die Sitzung inkl. super_admin.
//
// script-src braucht 'unsafe-inline', weil Next.js Inline-Skripte für die
// Hydration ausliefert (Nonces erst mit eigener proxy.ts). Fremde Skript-,
// Bild- und Verbindungsziele sind trotzdem gesperrt; img-src 'self' blockt
// auch externe Markdown-Bilder in Bot-Antworten (Tracking per Prompt-Injection).

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

function csp(frameAncestors: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}

export function securityHeaders({ dev }: { dev: boolean }): Rule[] {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    },
    {
      source: "/embed/:path*",
      headers: [{ key: "Content-Security-Policy", value: csp("*", dev) }],
    },
    {
      source: "/((?!embed/).*)",
      headers: [
        { key: "Content-Security-Policy", value: csp("'none'", dev) },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
  ];
}
