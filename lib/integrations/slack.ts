import { z } from "zod";
import type { IntegrationAdapter, LeadPayload } from "./types";

const configSchema = z.object({
  // Nur echte Slack-Webhooks: Der Server ruft die URL selbst auf — eine
  // beliebige URL wäre ein Hebel für Anfragen an interne Ziele (SSRF).
  webhook_url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://hooks.slack.com/"), "muss mit https://hooks.slack.com/ beginnen"),
});
type Config = z.infer<typeof configSchema>;

// Slack wertet in mrkdwn <!channel>, <@U…> und <url|Text> als Steuer-Syntax aus.
// Besucherwerte deshalb nach Slack-Vorgabe maskieren, sonst kann ein anonymer
// Besucher Massen-Erwähnungen und getarnte Links im Team-Slack auslösen.
function mrkdwn(value: string | null | undefined): string {
  if (!value) return "–";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function leadTypeLabel(type: string) {
  return type === "appointment" ? "📅 Terminanfrage"
    : type === "callback" ? "📞 Rückrufbitte"
    : "✉️ Kontaktanfrage";
}

export const slackAdapter: IntegrationAdapter<Config> = {
  id: "slack",
  label: "Slack",
  description: "Neue Leads als Slack-Nachricht erhalten",
  icon: "💬",
  setupHint: "Einrichten unter: Slack → Apps → Incoming Webhooks",
  fields: [
    // Die Webhook-URL ist selbst das Zugangsgeheimnis (wer sie kennt, kann posten).
    { key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", secret: true },
  ],
  verticals: "all",
  configSchema,

  async onLead(lead: LeadPayload, config: Config) {
    const typeLabel = leadTypeLabel(lead.type);

    const blocks: unknown[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `${typeLabel} – neuer Lead!` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name:*\n${mrkdwn(lead.name)}` },
          { type: "mrkdwn", text: `*E-Mail:*\n${mrkdwn(lead.email)}` },
          { type: "mrkdwn", text: `*Telefon:*\n${mrkdwn(lead.phone)}` },
          { type: "mrkdwn", text: `*Typ:*\n${typeLabel}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Nachricht:*\n${mrkdwn(lead.message)}` },
      },
    ];

    if (lead.appointment_topic || lead.appointment_window) {
      blocks.push({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Thema:*\n${mrkdwn(lead.appointment_topic)}` },
          { type: "mrkdwn", text: `*Zeitwunsch:*\n${mrkdwn(lead.appointment_window)}` },
        ],
      });
    }

    const res = await fetch(config.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) throw new Error(`Slack error: ${res.status}`);
    return { ok: true };
  },
};
