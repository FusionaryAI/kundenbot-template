import { NextRequest, NextResponse } from "next/server";
import { supaAdmin } from "@/lib/db";

/**
 * Serverseitige Auth-Helfer für API-Routen.
 *
 * Hintergrund: Die geschützten API-Routen nutzen den Service-Role-Key und
 * umgehen damit Supabase-RLS. Sie MÜSSEN daher selbst prüfen, wer der Aufrufer
 * ist. Der Client sendet dazu den Supabase-Access-Token als
 * `Authorization: Bearer <token>` (siehe lib/api-client.ts → authedFetch).
 */

export type AuthedUser = {
  id: string;
  email: string | null;
  role: string;
  tenant_id: string | null;
};

function bearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() || null : null;
}

/** Verifiziert den Access-Token und lädt Rolle + Tenant aus user_roles. */
export async function getAuthedUser(req: NextRequest): Promise<AuthedUser | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const { data, error } = await supaAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRow } = await supaAdmin
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", data.user.id)
    .single();
  if (!roleRow) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: roleRow.role,
    tenant_id: roleRow.tenant_id ?? null,
  };
}

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
const forbidden = () =>
  NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

type Gate = { user: AuthedUser } | { error: NextResponse };

/** Nur eingeloggte super_admins. */
export async function requireSuperAdmin(req: NextRequest): Promise<Gate> {
  const user = await getAuthedUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role !== "super_admin") return { error: forbidden() };
  return { user };
}

/**
 * Eingeloggt und Zugriff auf genau diesen Tenant — oder super_admin.
 * `tenantId` ist der vom Aufrufer angeforderte Tenant (Body/Query/Lookup).
 */
export async function requireTenantAccess(
  req: NextRequest,
  tenantId: string | null | undefined,
): Promise<Gate> {
  const user = await getAuthedUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role === "super_admin") return { user };
  if (!tenantId || user.tenant_id !== tenantId) return { error: forbidden() };
  return { user };
}
