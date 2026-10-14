/**
 * KI-VO (EU AI Act) Art. 50 Abs. 1 — gilt seit 02.08.2026:
 * Nutzer müssen spätestens bei der ersten Interaktion klar erkennen, dass sie
 * mit einer KI sprechen.
 *
 * Die Begrüßung ist kundenseitig überschreibbar (tenant_settings.welcome_message).
 * Der Hinweis wird deshalb IMMER vorangestellt — unabhängig davon, was der Kunde
 * einträgt. Früher entfiel er, sobald der Text "KI" oder "Bot" enthielt; damit
 * konnte ein Text wie "Kein Bot, echte Beratung!" den Hinweis aushebeln.
 */
export const AI_NOTICE = "Hier antwortet ein KI-Assistent.";

const DEFAULT_GREETING = "Wie kann ich Ihnen helfen?";

export function withAiNotice(text?: string | null): string {
  const t = (text ?? "").trim();
  // Bereits vorangestellt (z. B. Server und Widget wenden die Funktion beide an).
  if (t.startsWith(AI_NOTICE)) return t;
  return `${AI_NOTICE} ${t || DEFAULT_GREETING}`;
}
