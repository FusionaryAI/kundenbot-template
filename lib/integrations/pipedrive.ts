import { z } from "zod";
import type { IntegrationAdapter, LeadPayload } from "./types";

const configSchema = z.object({
  api_key: z.string().min(1),
});
type Config = z.infer<typeof configSchema>;

export const pipedriveAdapter: IntegrationAdapter<Config> = {
  id: "pipedrive",
  label: "Pipedrive",
  verticals: "all",
  configSchema,

  async onLead(lead: LeadPayload, config: Config) {
    const baseUrl = `https://api.pipedrive.com/v1`;

    // 1) Person anlegen
    const personRes = await fetch(`${baseUrl}/persons?api_token=${config.api_key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: lead.name ?? "Unbekannt",
        email: lead.email ? [{ value: lead.email, primary: true }] : undefined,
        phone: lead.phone ? [{ value: lead.phone, primary: true }] : undefined,
      }),
    });

    const personData = await personRes.json().catch(() => ({}));
    const personId = personData?.data?.id;

    // 2) Lead anlegen
    const leadRes = await fetch(`${baseUrl}/leads?api_token=${config.api_key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${lead.name ?? "Neuer Lead"} – ${
          lead.type === "appointment" ? "Terminanfrage"
          : lead.type === "callback" ? "Rückrufbitte"
          : "Kontaktanfrage"
        }`,
        person_id: personId,
        note: lead.message,
      }),
    });

    const leadData = await leadRes.json().catch(() => ({}));
    if (!leadRes.ok) throw new Error(`Pipedrive error: ${leadRes.status}`);
    return { ok: true, lead_id: leadData?.data?.id };
  },
};
