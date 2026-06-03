import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth-server";
import { getIntegration } from "@/lib/integrations/registry";

export const runtime = "nodejs";

type IncomingIntegration = {
  integration: string;
  config?: Record<string, unknown>;
};

// Entfernt leere Felder; gibt true zurück, wenn danach nichts mehr übrig ist.
function cleanConfig(config: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config ?? {})) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) out[k] = trimmed;
    } else if (v !== null && v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, integrations } = body as {
      tenant_id?: string;
      integrations?: IncomingIntegration[];
    };

    if (!tenant_id || !Array.isArray(integrations)) {
      return NextResponse.json(
        { ok: false, error: "tenant_id und integrations[] erforderlich" },
        { status: 400 },
      );
    }

    const gate = await requireTenantAccess(req, tenant_id);
    if ("error" in gate) return gate.error;

    const results: Record<string, { ok: boolean; active?: boolean; error?: string }> = {};

    for (const item of integrations) {
      const adapter = getIntegration(item.integration);
      if (!adapter) {
        results[item.integration] = { ok: false, error: "unbekannte Integration" };
        continue;
      }

      const config = cleanConfig(item.config);

      // Leere Config → Integration deaktivieren (Zeile entfernen).
      if (Object.keys(config).length === 0) {
        const { error } = await supaAdmin
          .from("tenant_integrations")
          .delete()
          .eq("tenant_id", tenant_id)
          .eq("integration", adapter.id);
        results[adapter.id] = error
          ? { ok: false, error: error.message }
          : { ok: true, active: false };
        continue;
      }

      // Config validieren, bevor sie gespeichert wird.
      const parsed = adapter.configSchema.safeParse(config);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        results[adapter.id] = {
          ok: false,
          error: first ? `${first.path.join(".")}: ${first.message}` : "ungültige Konfiguration",
        };
        continue;
      }

      const { error } = await supaAdmin
        .from("tenant_integrations")
        .upsert(
          {
            tenant_id,
            integration: adapter.id,
            enabled: true,
            config: parsed.data as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,integration" },
        );

      results[adapter.id] = error
        ? { ok: false, error: error.message }
        : { ok: true, active: true };
    }

    const allOk = Object.values(results).every((r) => r.ok);
    return NextResponse.json({ ok: allOk, results });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
