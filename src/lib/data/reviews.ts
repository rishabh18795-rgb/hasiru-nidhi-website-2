import "server-only";

import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { PublicReviews } from "@/lib/db/types";

/** Approved reviews of a public listing, from the database's public function. Null when the listing is not public. */
export async function getPublicReviews(kind: "product" | "service", slug: string): Promise<PublicReviews | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const { data } = await createPublicSupabase(30).rpc("get_marketplace_reviews", { p_kind: kind, p_slug: slug, p_limit: 20 });
    return (data as PublicReviews | null) ?? null;
  } catch {
    return null;
  }
}
