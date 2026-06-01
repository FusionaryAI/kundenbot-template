"use client";

import { supabase } from "@/lib/supabase";

/**
 * fetch-Wrapper, der automatisch den Supabase-Access-Token der aktuellen
 * Sitzung als `Authorization: Bearer <token>` mitsendet. Für alle Aufrufe an
 * geschützte API-Routen (Dashboard-/Admin-Funktionen) verwenden.
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers || {});
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(input, { ...init, headers });
}
