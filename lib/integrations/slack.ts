import { z } from "zod";
import type { IntegrationAdapter, LeadPayload } from "./types";

const configSchema = z.object({
  webhook_url: z.string().url(),
});
type Config = z.infer<typeof configSchema>;

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
    { key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/..." },
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
          { type: "mrkdwn", text: `*Name:*\n${lead.name ?? "–"}` },
          { type: "mrkdwn", text: `*E-Mail:*\n${lead.email ?? "–"}` },
          { type: "mrkdwn", text: `*Telefon:*\n${lead.phone ?? "–"}` },
          { type: "mrkdwn", text: `*Typ:*\n${typeLabel}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Nachricht:*\n${lead.message}` },
      },
    ];

    if (lead.appointment_topic || lead.appointment_window) {
      blocks.push({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Thema:*\n${lead.appointment_topic ?? "–"}` },
          { type: "mrkdwn", text: `*Zeitwunsch:*\n${lead.appointment_window ?? "–"}` },
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
