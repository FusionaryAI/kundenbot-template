import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { getIntegration } from "@/lib/integrations/registry";
import type { LeadPayload } from "@/lib/integrations/types";

export const runtime = "nodejs";

type ConfiguredIntegration = { integration: string; config: Record<string, unknown> };

// Lädt die aktiven Integrationen eines Tenants. Bevorzugt die neue
// tenant_integrations-Tabelle; fällt — solange noch nicht migriert/gepflegt —
// auf die alten tenant_settings-Spalten zurück, damit nichts ausfällt.
async function loadIntegrations(tenantId: string): Promise<ConfiguredIntegration[]> {
  const { data: rows } = await supaAdmin
    .from("tenant_integrations")
    .select("integration, config, enabled")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);

  if (rows && rows.length > 0) {
    return rows.map((r) => ({
      integration: r.integration as string,
      config: (r.config ?? {}) as Record<string, unknown>,
    }));
  }

  // Legacy-Fallback: aus tenant_settings rekonstruieren.
  const { data: settings } = await supaAdmin
    .from("tenant_settings")
    .select("slack_webhook_url, hubspot_api_key, pipedrive_api_key")
    .eq("tenant_id", tenantId)
    .single();

  const legacy: ConfiguredIntegration[] = [];
  if (settings?.slack_webhook_url)
    legacy.push({ integration: "slack", config: { webhook_url: settings.slack_webhook_url } });
  if (settings?.hubspot_api_key)
    legacy.push({ integration: "hubspot", config: { api_key: settings.hubspot_api_key } });
  if (settings?.pipedrive_api_key)
    legacy.push({ integration: "pipedrive", config: { api_key: settings.pipedrive_api_key } });
  return legacy;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, lead } = body as { tenant_id: string; lead: LeadPayload };

    if (!tenant_id || !lead) {
      return NextResponse.json({ ok: false, error: "tenant_id und lead erforderlich" }, { status: 400 });
    }

    const configured = await loadIntegrations(tenant_id);
    const results: Record<string, unknown> = {};

    // Adapter isoliert ausführen — ein Fehler bei einem Anbieter darf die
    // übrigen Benachrichtigungen nicht verhindern.
    for (const { integration, config } of configured) {
      const adapter = getIntegration(integration);
      if (!adapter?.onLead) continue;

      try {
        const parsed = adapter.configSchema.safeParse(config);
        if (!parsed.success) {
          results[integration] = { ok: false, error: "invalid config" };
          continue;
        }
        results[integration] = await adapter.onLead(lead, parsed.data);
      } catch (e: unknown) {
        results[integration] = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
