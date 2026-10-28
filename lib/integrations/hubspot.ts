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
    const candidates: Record<string, string | null | undefined> = {
      firstname: lead.name?.split(" ")[0],
      lastname: lead.name?.split(" ").slice(1).join(" "),
      email: lead.email,
      phone: lead.phone,
      message: lead.message,
      hs_lead_status: "NEW",
    };
    // Leere Werte weglassen: HubSpot würde sonst vorhandene Eigenschaften leeren.
    const properties = Object.fromEntries(
      Object.entries(candidates).filter((entry): entry is [string, string] => !!entry[1]),
    );

    // Nur neu anlegen. Den Lead reicht ein anonymer Besucher ein; er darf
    // bestehende CRM-Kontakte des Kunden nicht verändern, auch wenn er deren
    // E-Mail-Adresse kennt. Die Anfrage selbst kommt per Mail und im Dashboard an.
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({ properties }),
    });

    const data = await res.json().catch(() => ({}));

    // 409 = Kontakt existiert bereits → unverändert lassen.
    if (res.status === 409) return { ok: true, existing: true };

    // Nur den Status melden: Die Antwort kann Kontaktdaten des Leads enthalten.
    if (!res.ok) throw new Error(`HubSpot error: ${res.status}`);
    return { ok: true, contact_id: data.id };
  },
};
