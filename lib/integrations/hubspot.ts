import { z } from "zod";
import type { IntegrationAdapter, LeadPayload } from "./types";

const configSchema = z.object({
  api_key: z.string().min(1),
});
type Config = z.infer<typeof configSchema>;

export const hubspotAdapter: IntegrationAdapter<Config> = {
  id: "hubspot",
  label: "HubSpot",
  description: "Leads automatisch als Kontakte anlegen",
  icon: "🔶",
  setupHint: "Einrichten unter: HubSpot → Einstellungen → Integrationen → Private Apps",
  fields: [
    { key: "api_key", label: "Private App Token", placeholder: "pat-eu1-...", secret: true },
  ],
  verticals: "all",
  configSchema,

  async onLead(lead: LeadPayload, config: Config) {
    const properties: Record<string, string> = {
      firstname: lead.name?.split(" ")[0] ?? "",
      lastname: lead.name?.split(" ").slice(1).join(" ") ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      message: lead.message,
      hs_lead_status: "NEW",
    };

    // Kontakt anlegen oder aktualisieren
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({ properties }),
    });

    const data = await res.json().catch(() => ({}));

    // 409 = Kontakt existiert bereits → Update
    if (res.status === 409 && data?.message?.includes("Contact already exists")) {
      const existingId = data.message.match(/ID: (\d+)/)?.[1];
      if (existingId) {
        await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.api_key}`,
          },
          body: JSON.stringify({ properties }),
        });
      }
      return { ok: true, updated: true };
    }

    if (!res.ok) throw new Error(`HubSpot error: ${res.status} – ${JSON.stringify(data)}`);
    return { ok: true, contact_id: data.id };
  },
};
