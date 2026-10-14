import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";
import { getIntegration, listIntegrations } from "@/lib/integrations/registry";
import { loadIntegrations, saveIntegration, secretFieldKeys } from "@/lib/integrations/store";

export const runtime = "nodejs";

// Entfernt leere Felder.
function cleanConfig(config: Record<string, string> | undefined) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config ?? {})) {
    const trimmed = v.trim();
    if (trimmed) out[k] = trimmed;
  }
  return out;
}

/**
 * Liefert die Konfiguration für den Editor — geheime Felder nur als
 * "ist gesetzt", nie als Wert. Gespeicherte Tokens verlassen den Server nicht.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "tenant_id erforderlich" }, { status: 400 });
  }
  const gate = await requireTenantAccess(req, tenantId);
  if ("error" in gate) return gate.error;

  const stored = await loadIntegrations(tenantId);
  const integrations: Record<string, { values: Record<string, string>; secretsSet: string[] }> = {};
  for (const { adapter, config } of stored) {
    const secrets = secretFieldKeys(adapter);
    const values: Record<string, string> = {};
    const secretsSet: string[] = [];
    for (const field of adapter.fields) {
      const v = config[field.key];
      if (typeof v !== "string" || !v) continue;
      if (secrets.includes(field.key)) secretsSet.push(field.key);
      else values[field.key] = v;
    }
    integrations[adapter.id] = { values, secretsSet };
  }
  return NextResponse.json({ ok: true, integrations });
}

const bodySchema = z.object({
  tenant_id: z.string().min(1),
  integrations: z
    .array(
      z.object({
        integration: z.string().min(1).max(64),
        config: z.record(z.string(), z.string().max(2000)).optional(),
        // Explizites Entfernen — leere Geheimfelder bedeuten "unverändert lassen".
        remove: z.boolean().optional(),
      }),
    )
    .max(listIntegrations().length),
});

export async function POST(req: NextRequest) {
  try {
    const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: "tenant_id und integrations[] erforderlich" },
        { status: 400 },
      );
    }
    const { tenant_id, integrations } = parsedBody.data;

    const gate = await requireTenantAccess(req, tenant_id);
    if ("error" in gate) return gate.error;

    const existing = new Map(
      (await loadIntegrations(tenant_id)).map((s) => [s.adapter.id, s.config]),
    );
    const results: Record<string, { ok: boolean; active?: boolean; error?: string }> = {};

    for (const item of integrations) {
      const adapter = getIntegration(item.integration);
      if (!adapter) {
        results[item.integration] = { ok: false, error: "unbekannte Integration" };
        continue;
      }

      if (item.remove) {
        const { error } = await supaAdmin
          .from("tenant_integrations")
          .delete()
          .eq("tenant_id", tenant_id)
          .eq("integration", adapter.id);
        if (error) console.error("[settings/integrations] entfernen:", error.message);
        results[adapter.id] = error
          ? { ok: false, error: "Entfernen fehlgeschlagen" }
          : { ok: true, active: false };
        continue;
      }

      const config = cleanConfig(item.config);

      // Leer gelassene Geheimfelder behalten den gespeicherten Wert — der
      // Editor bekommt ihn nie zu sehen und kann ihn daher nicht mitsenden.
      const previous = existing.get(adapter.id);
      if (previous) {
        for (const key of secretFieldKeys(adapter)) {
          if (config[key] === undefined && typeof previous[key] === "string") {
            config[key] = previous[key];
          }
        }
      }

      // Nichts eingetragen → nichts ändern. Gelöscht wird nur über `remove`,
      // damit ein leeres Formular (z. B. bei fehlendem Schlüssel) keine
      // bestehende Integration still entfernt.
      if (Object.keys(config).length === 0) {
        results[adapter.id] = { ok: true, active: !!previous };
        continue;
      }

      const parsed = adapter.configSchema.safeParse(config);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        results[adapter.id] = {
          ok: false,
          error: first ? `${first.path.join(".")}: ${first.message}` : "ungültige Konfiguration",
        };
        continue;
      }

      const { error } = await saveIntegration(
        tenant_id,
        adapter,
        parsed.data as Record<string, unknown>,
      );
      if (error) console.error("[settings/integrations] speichern:", error);
      results[adapter.id] = error
        ? { ok: false, error: "Speichern fehlgeschlagen" }
        : { ok: true, active: true };
    }

    const allOk = Object.values(results).every((r) => r.ok);
    return NextResponse.json({ ok: allOk, results });
  } catch (e: unknown) {
    console.error("[settings/integrations]", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
