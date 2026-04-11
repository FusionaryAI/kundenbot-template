import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ADMIN_KEY;

if (!SUPABASE_URL) {
  throw new Error("ENV ERROR: SUPABASE_URL is missing.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("ENV ERROR: SUPABASE_SERVICE_ROLE(_KEY) is missing.");
}

export const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});