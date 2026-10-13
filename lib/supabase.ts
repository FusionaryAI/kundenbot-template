import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Neuer Publishable Key (sb_publishable_…) zuerst, Legacy-anon-Key als Fallback
// (siehe docs/supabase-api-keys-umstellung.md).
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

// Sicherheit: NEXT_PUBLIC_-Werte landen im JS-Bundle. Ein Secret Key hier wäre
// öffentlich — Build und Seiten sollen dann sofort scheitern.
if (supabaseAnonKey?.startsWith("sb_secret_")) {
  throw new Error("ENV ERROR: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a secret key.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
