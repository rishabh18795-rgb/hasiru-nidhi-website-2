/**
 * Supabase configuration. Nothing here throws when variables are missing: the public
 * marketing site must keep working without a backend, and every backend-dependent page
 * checks `isSupabaseConfigured()` and shows a clear "not configured" state instead.
 */
export function getSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().configured;
}
