import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

export const runtime = "nodejs";

type LeadPayload = {
  tenant_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message: string;
  type: string;
  appointment_topic?: string | null;
  appointment_window?: string | null;
};

// --------------------
// Slack
// --------------------

async function notifySlack(webhookUrl: string, lead: LeadPayload) {
  const typeLabel =
    lead.type === "appointment" ? "📅 Terminanfrage"
    : lead.type === "callback" ? "📞 Rückrufbitte"
    : "✉️ Kontaktanfrage";

  const blocks = [
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
    } as any);
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) throw new Error(`Slack error: ${res.status}`);
  return { ok: true };
}

// --------------------
// HubSpot
// --------------------

async function notifyHubSpot(apiKey: string, lead: LeadPayload) {
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
      "Authorization": `Bearer ${apiKey}`,
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
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ properties }),
      });
    }
    return { ok: true, updated: true };
  }

  if (!res.ok) throw new Error(`HubSpot error: ${res.status} – ${JSON.stringify(data)}`);
  return { ok: true, contact_id: data.id };
}

// --------------------
// Pipedrive
// --------------------

async function notifyPipedrive(apiKey: string, lead: LeadPayload) {
  const baseUrl = `https://api.pipedrive.com/v1`;

  // 1) Person anlegen
  const personRes = await fetch(`${baseUrl}/persons?api_token=${apiKey}`, {
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
  const leadRes = await fetch(`${baseUrl}/leads?api_token=${apiKey}`, {
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
}

// --------------------
// Handler
// --------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, lead } = body as { tenant_id: string; lead: LeadPayload };

    if (!tenant_id || !lead) {
      return NextResponse.json({ ok: false, error: "tenant_id und lead erforderlich" }, { status: 400 });
    }

    const { data: settings } = await supaAdmin
      .from("tenant_settings")
      .select("slack_webhook_url, hubspot_api_key, pipedrive_api_key")
      .eq("tenant_id", tenant_id)
      .single();

    const results: Record<string, any> = {};

    // Slack
    if (settings?.slack_webhook_url) {
      try {
        results.slack = await notifySlack(settings.slack_webhook_url, lead);
      } catch (e: any) {
        results.slack = { ok: false, error: e?.message };
      }
    }

    // HubSpot
    if (settings?.hubspot_api_key) {
      try {
        results.hubspot = await notifyHubSpot(settings.hubspot_api_key, lead);
      } catch (e: any) {
        results.hubspot = { ok: false, error: e?.message };
      }
    }

    // Pipedrive
    if (settings?.pipedrive_api_key) {
      try {
        results.pipedrive = await notifyPipedrive(settings.pipedrive_api_key, lead);
      } catch (e: any) {
        results.pipedrive = { ok: false, error: e?.message };
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}