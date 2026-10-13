import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL;

// Neuer Secret Key (sb_secret_…) zuerst; die Legacy-Namen bleiben als Fallback,
// damit die Umstellung ohne Ausfall läuft (siehe docs/supabase-api-keys-umstellung.md).
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ADMIN_KEY;

if (!SUPABASE_URL) {
  throw new Error("ENV ERROR: SUPABASE_URL is missing.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("ENV ERROR: SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE) is missing.");
}

// Sicherheit: Mit einem Publishable Key liefe der Admin-Client still mit
// anon-Rechten — lieber sofort und laut scheitern.
if (SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_")) {
  throw new Error("ENV ERROR: SUPABASE_SECRET_KEY contains a publishable key, expected sb_secret_….");
}

export const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
