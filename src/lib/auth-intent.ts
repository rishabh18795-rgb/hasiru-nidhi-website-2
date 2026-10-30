import { safeNextPath } from "@/lib/auth";

/**
 * What a visitor was trying to do when they started Google sign-in, kept in a short-lived httpOnly cookie set by the SERVER
 * (not in the redirect URL, which Supabase would have to allow-list and anyone could edit). The intent only picks the
 * landing page and whether to offer the host upgrade; it can never grant admin, and the actual role change still goes through
 * become_host() on the database, called with the user's own verified session.
 */
export const OAUTH_INTENT_COOKIE = "hn_auth_intent";
export const OAUTH_INTENT_MAX_AGE_SECONDS = 600;

export type OAuthKind = "customer" | "host";
export interface OAuthIntent { kind: OAuthKind; next: string | null }

export const defaultLanding = (kind: OAuthKind) => (kind === "host" ? "/host/properties/new" : "/dashboard");

export function serializeIntent(kind: OAuthKind, next: string | null | undefined): string {
  return JSON.stringify({ k: kind, n: next ? safeNextPath(next, "") || null : null });
}

/** Anything missing, malformed or tampered with falls back to a plain customer sign-in. */
export function parseIntent(raw: string | null | undefined): OAuthIntent {
  const fallback: OAuthIntent = { kind: "customer", next: null };
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as { k?: unknown; n?: unknown };
    const kind: OAuthKind = v.k === "host" ? "host" : "customer";
    const next = typeof v.n === "string" ? safeNextPath(v.n, "") || null : null;
    return { kind, next };
  } catch {
    return fallback;
  }
}

/** A brand-new account (created within this window) may be upgraded to host by the host Google flow; older accounts must use the explicit upgrade. */
export const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
export const isNewAccount = (createdAt: string | undefined, now = Date.now()) => {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) && now - t >= 0 && now - t < NEW_ACCOUNT_WINDOW_MS;
};
