import { createHash, createHmac } from "node:crypto";

/**
 * Rate Limiting für die öffentlichen Endpunkte (Chat, Lead-Erfassung, Widget).
 *
 * Zähler liegen in Supabase (Tabelle rate_limits, Funktion rate_limit_hit —
 * Migration 20261014120000_security_hardening.sql). Warum nicht im Speicher:
 * Vercel startet viele kurzlebige Instanzen, ein In-Memory-Zähler wäre pro
 * Instanz und damit wirkungslos. Warum kein Redis-Dienst: Das wäre ein
 * zusätzlicher Unterauftragsverarbeiter im AVV — die Datenbank haben wir schon.
 *
 * Datenschutz: Gespeichert wird nie die IP-Adresse, sondern ein HMAC mit
 * geheimem Schlüssel (RATE_LIMIT_SECRET). Ohne den Schlüssel lässt sich der
 * Wert nicht durch Ausprobieren aller IPv4-Adressen zurückrechnen. Einträge
 * werden nach Ablauf des Zeitfensters per pg_cron gelöscht (≤ 1 Stunde).
 */

export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  // Ein Mensch schreibt keine 20 Nachrichten pro Minute; schützt das LLM-Budget.
  chat: { scope: "chat", limit: 20, windowSeconds: 60 },
  // Jeder Lead löst eine E-Mail an den Kunden aus — Spam-Schutz für sein Postfach.
  leads: { scope: "leads", limit: 5, windowSeconds: 600 },
  // Begrüßungstext beim Öffnen des Chats.
  widget: { scope: "widget", limit: 30, windowSeconds: 60 },
  // Wissenstest im Dashboard: angemeldet, aber jeder Aufruf kostet LLM-Tokens.
  knowledgeTest: { scope: "kb-test", limit: 20, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * IP des Aufrufers. Vercel überschreibt x-forwarded-for an der Edge mit der
 * echten Client-IP; vom Client mitgeschickte Werte kommen dort nicht durch.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

let warnedMissingSecret = false;

export function rateLimitKey(scope: string, ip: string, secret = process.env.RATE_LIMIT_SECRET): string {
  if (!secret && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn("[rate-limit] RATE_LIMIT_SECRET fehlt — IP-Hash ohne geheimen Schlüssel");
  }
  const digest = secret
    ? createHmac("sha256", secret).update(ip).digest("hex")
    : createHash("sha256").update(ip).digest("hex");
  return `${scope}:${digest.slice(0, 32)}`;
}

/** Minimale Schnittstelle des Supabase-Clients — erlaubt Tests ohne Datenbank. */
export type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

export async function checkRateLimit(
  db: RpcClient,
  headers: Headers,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<RateLimitResult> {
  const { data, error } = await db.rpc("rate_limit_hit", {
    p_key: rateLimitKey(rule.scope, clientIp(headers)),
    p_window_seconds: rule.windowSeconds,
  });

  // Fail open: Ist die Datenbank nicht erreichbar, funktioniert der Chat
  // ohnehin nicht — ein Zählerfehler soll ihn nicht zusätzlich sperren.
  if (error || !data || typeof data !== "object") {
    console.error("[rate-limit] Zähler nicht verfügbar:", error?.message ?? "keine Daten");
    return { limited: false };
  }

  const { count, reset_at } = data as { count: number; reset_at: string };
  if (count <= rule.limit) return { limited: false };

  const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(reset_at) - now) / 1000));
  return { limited: true, retryAfterSeconds };
}

/** 429-Antwort mit Retry-After; der Text wird im Chat-Widget direkt angezeigt. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { ok: false, error: "Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es dann erneut." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
