import { createClient } from "@supabase/supabase-js";

// Wir unterstützen exakt deine ENV-Bezeichnungen
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

// Harte Guards – wenn hier etwas fehlt, soll der Build FAILEN
if (!supabaseUrl) {
  throw new Error(
    "ENV ERROR: SUPABASE_URL is missing. Check Vercel Environment Variables."
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "ENV ERROR: SUPABASE_SERVICE_ROLE is missing. This key is REQUIRED for supaAdmin."
  );
}

// Admin-Client (umgeht RLS vollständig)
export const supaAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});