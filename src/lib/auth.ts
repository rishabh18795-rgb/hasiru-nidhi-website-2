import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AppRole, Profile } from "@/lib/db/types";

export interface Session {
  supabase: SupabaseClient;
  user: User;
  profile: Profile;
}

/** Only allow same-site relative redirects after sign-in (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Current session or null. Validates the JWT with the Auth server (getUser), never trusts cookies alone. */
export const getSession = cache(async (): Promise<Session | null> => {
  // Reading cookies opts the calling page into per-request (dynamic) rendering — ALWAYS, even when
  // Supabase is unconfigured at build time. Without this, auth redirects could be prerendered
  // (frozen) into static output and then served to signed-in users in production.
  await cookies();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { supabase, user, profile: profile as Profile };
});

/** Require a signed-in, non-suspended user. */
export async function requireUser(nextPath?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect(nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in");
  }
  if (session.profile.is_suspended) redirect("/account-suspended");
  return session;
}

/**
 * Require one of the given roles — checked from the database profile on every request, so a
 * tampered cookie, URL or request body can never grant access. Wrong role -> back to /dashboard.
 */
export async function requireRole(roles: AppRole[], nextPath?: string): Promise<Session> {
  const session = await requireUser(nextPath);
  if (!roles.includes(session.profile.role)) {
    // A traveller reaching a host page wants to host: offer the one-click upgrade instead of a dead end.
    if (roles.includes("host") && session.profile.role === "traveller") redirect("/list-your-property?become=host");
    redirect("/dashboard?denied=1");
  }
  return session;
}

/** For server actions: same checks, but throws instead of redirecting so the action can report. */
export async function assertRole(roles: AppRole[]): Promise<Session> {
  const session = await getSession();
  if (!session || session.profile.is_suspended || !roles.includes(session.profile.role)) {
    throw new AuthorizationError();
  }
  return session;
}

export class AuthorizationError extends Error {
  constructor() {
    super("You do not have permission to do that.");
    this.name = "AuthorizationError";
  }
}
