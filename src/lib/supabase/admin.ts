import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";

export function isServiceRoleConfigured(): boolean {
  return Boolean(getSupabaseConfig().url && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Service-role client. BYPASSES Row Level Security — import it only from trusted server code
 * (the `server-only` import above makes a client-side import a build error) and only for jobs
 * that genuinely need it (private enquiry-photo uploads, signed URLs for admins).
 */
export function createAdminSupabase(): SupabaseClient {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase service role is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
