import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function supabaseUrl() {
  return envValue("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_PROJECT_URL");
}

function supabaseServiceKey() {
  return envValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY");
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) return null;

  if (!client) {
    client = createClient(
      supabaseUrl(),
      supabaseServiceKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return client;
}
