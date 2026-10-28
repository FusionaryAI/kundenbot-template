import { z } from "zod";

// Eingaben von POST /api/chat (öffentlich, ohne Login). Alles, was der Client
// mitschickt, landet in LLM-Prompts, in Leads, in E-Mails und bei Integrationen.
// Die Grenzen entsprechen POST /api/leads (app/api/leads/route.ts): Der
// Chat-Handoff ist ein zweiter Weg zu createLead und darf sie nicht umgehen.
// Ungültige Felder werden verworfen und zu lange gekürzt, damit der Chat für
// echte Besucher weiterläuft statt mit 400 abzubrechen.

export const MAX_MESSAGE_CHARS = 2000;
const HISTORY_TURNS = 6;

export type LeadType = "contact" | "appointment" | "callback";

export type PageContext = {
  page_url?: string | null;
  page_path?: string | null;
  page_title?: string | null;
  tenant_label?: string | null;
  surface?: string | null;
};

export type HandoffState = {
  active: boolean;
  stage?: "offered" | "collect_name" | "collect_contact" | "collect_message" | "ready";
  lead_type?: LeadType;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
  phone?: string;
  message?: string;
  appointment_topic?: string | null;
  appointment_window?: string | null;
  offered_at_ts?: number;
  completed?: boolean;
  preferred_contact?: "email" | "phone";
  page_context?: PageContext | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

const text = (max: number) =>
  z.string().trim().transform((v) => v.slice(0, max) || undefined).optional().catch(undefined);

const pageContextSchema = z
  .object({
    page_url: text(2000),
    page_path: text(2000),
    page_title: text(500),
    tenant_label: text(200),
    surface: text(50),
  })
  .nullable()
  .catch(null);

const handoffSchema = z.object({
  // optional(): ab zod 4.6 gilt ein fehlender z.unknown()-Schlüssel sonst als Fehler.
  active: z.unknown().optional().transform(Boolean),
  completed: z.unknown().optional().transform(Boolean),
  stage: z.enum(["offered", "collect_name", "collect_contact", "collect_message", "ready"]).optional().catch(undefined),
  lead_type: z.enum(["contact", "appointment", "callback"]).optional().catch(undefined),
  preferred_contact: z.enum(["email", "phone"]).optional().catch(undefined),
  offered_at_ts: z.number().finite().optional().catch(undefined),
  name: text(200),
  email: text(254),
  phone: text(50),
  message: text(5000),
  first_name: text(100).transform((v) => v ?? null),
  last_name: text(100).transform((v) => v ?? null),
  appointment_topic: text(500).transform((v) => v ?? null),
  appointment_window: text(500).transform((v) => v ?? null),
  page_context: pageContextSchema,
});

/** Felder ohne Wert weglassen, damit der Zustand wie bisher nur gesetzte Schlüssel trägt. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function parsePageContext(raw: unknown): PageContext | null {
  const ctx = pageContextSchema.parse(raw);
  return ctx ? compact(ctx) : null;
}

export function parseHandoff(raw: unknown): HandoffState {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return compact(handoffSchema.parse(input) as HandoffState);
}

export function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is ChatTurn =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim().length > 0,
    )
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

export function parseConversationId(raw: unknown): string | null {
  const id = typeof raw === "string" ? raw.trim() : "";
  return id && id.length <= 100 ? id : null;
}
