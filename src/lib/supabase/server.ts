import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";

/** Per-request client that acts as the signed-in user (RLS applies). Use in Server Components/Actions. */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes
          // sessions, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Cookie-less anonymous client for PUBLIC data (approved listings, catalogue, public settings).
 * Because it never touches cookies, pages using it can still be statically rendered/cached.
 */
export function createPublicSupabase(revalidateSeconds = 60): SupabaseClient {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) throw new Error("Supabase is not configured");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: revalidateSeconds } } as RequestInit),
    },
  });
}
