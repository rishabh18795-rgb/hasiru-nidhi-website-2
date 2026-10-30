import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth";
import { OAUTH_INTENT_COOKIE, defaultLanding, isNewAccount, parseIntent } from "@/lib/auth-intent";

/**
 * Handles every return trip from Supabase Auth: e-mail verification, password recovery and Google sign-in (PKCE code exchange).
 * Roles are never taken from the URL. For host intent (read from a server-set httpOnly cookie) a brand-new account is upgraded
 * with the audited become_host() function using the user's own session; an older traveller account is sent to the explicit
 * upgrade page instead, and an administrator is never changed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`);

  const jar = await cookies();
  const intent = parseIntent(jar.get(OAUTH_INTENT_COOKIE)?.value);
  jar.delete(OAUTH_INTENT_COOKIE);

  // The visitor pressed Cancel at Google, or the provider refused.
  const providerError = searchParams.get("error");
  if (providerError) return go(`/sign-in?error=${providerError === "access_denied" ? "oauth_cancelled" : "oauth_failed"}`);

  const code = searchParams.get("code");
  if (!code || !isSupabaseConfigured()) return go("/sign-in?error=link_invalid");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return go(`/sign-in?error=${intent.kind === "host" || searchParams.get("next") === null ? "oauth_failed" : "link_invalid"}`);

  const explicitNext = searchParams.get("next");
  const destination = safeNextPath(explicitNext ?? intent.next, defaultLanding(intent.kind));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return go("/sign-in?error=oauth_failed");
  const { data: profile } = await supabase.from("profiles").select("role, is_suspended").eq("id", user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return go("/sign-in?error=missing_profile");
  }
  if (profile.is_suspended) return go("/account-suspended");

  if (intent.kind === "host" && explicitNext === null) {
    if (profile.role === "admin") return go("/admin");
    if (profile.role === "traveller") {
      // Only a just-created account is upgraded automatically; an existing traveller account uses the explicit, visible upgrade.
      if (!isNewAccount(user.created_at)) return go("/list-your-property?become=host");
      const { error: upgradeError } = await supabase.rpc("become_host");
      if (upgradeError) return go("/list-your-property?error=become_host");
    }
  }
  return go(destination);
}
