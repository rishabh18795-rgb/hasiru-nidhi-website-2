import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";

export interface Limit {
  limit: number;
  windowSeconds: number;
}

/** Generous for real people, expensive for scripts. Counted per client (or per signed-in user). */
export const LIMITS = {
  enquiry: { limit: 5, windowSeconds: 600 },
  report: { limit: 5, windowSeconds: 3600 },
  bookingRequest: { limit: 10, windowSeconds: 600 },
  upload: { limit: 30, windowSeconds: 600 },
} satisfies Record<string, Limit>;

export const RATE_LIMITED_MESSAGE = "You're sending requests too quickly. Please wait a few minutes and try again.";

/** Client address as set by the hosting proxy (Vercel overwrites these headers, so callers cannot spoof them). */
export function clientIp(h: Pick<Headers, "get">): string {
  const raw = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "";
  return raw.trim() || "unknown";
}

/** Buckets hold a hash, never the raw address, so the table contains no personal data. */
export function bucketFor(action: string, subject: string): string {
  return `${action}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
}

/**
 * Returns false when the caller has exceeded the limit for this action.
 * Counters live in Postgres (rate_limit_hit), so the limit holds across all serverless instances.
 * Fails OPEN when the service-role key is not configured or the counter is unreachable: a broken
 * limiter must never block genuine enquiries or bookings. The condition is logged, not hidden.
 */
export async function withinRateLimit(action: keyof typeof LIMITS, subject?: string): Promise<boolean> {
  if (!isServiceRoleConfigured()) return true;
  try {
    const who = subject ?? clientIp(await headers());
    const { limit, windowSeconds } = LIMITS[action];
    const { data, error } = await createAdminSupabase().rpc("rate_limit_hit", {
      p_bucket: bucketFor(action, who),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate limiter unavailable (failing open):", error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error("rate limiter threw (failing open):", err instanceof Error ? err.message : "unknown error");
    return true;
  }
}
