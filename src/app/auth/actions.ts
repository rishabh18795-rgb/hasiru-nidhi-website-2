"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth";
import { formValues, zodFieldErrors, type FormState } from "@/lib/action";
import { forgotSchema, resetSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { siteConfig } from "@/lib/site";
import { canCreateHosts, markNewAccountAsHost } from "@/lib/auth-admin";
import { OAUTH_INTENT_COOKIE, OAUTH_INTENT_MAX_AGE_SECONDS, defaultLanding, serializeIntent } from "@/lib/auth-intent";

const NOT_CONFIGURED: FormState = {
  ok: false,
  message: "Accounts are not available yet: the authentication service has not been configured for this site.",
};

/** Absolute site origin for e-mail links; prefers the request origin so previews work too. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : siteConfig.url;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values: { email: values.email ?? "" } };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Deliberately generic: do not reveal whether the e-mail exists.
    const unconfirmed = /not confirmed/i.test(error.message);
    return {
      ok: false,
      message: unconfirmed
        ? "Please verify your email address first — check your inbox for the confirmation link."
        : "Incorrect email or password.",
      values: { email: parsed.data.email },
    };
  }
  redirect(safeNextPath(values.next));
}

type SignUpKind = "customer" | "host";

/**
 * Creates an account. The ROLE is decided here, on the server, by which action was called — never by anything in the form or in
 * the sign-up metadata (the database ignores that). Hosts are upgraded with the service role right after the user exists.
 */
async function register(kind: SignUpKind, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(values);
  const echo = { full_name: values.full_name ?? "", email: values.email ?? "", phone: values.phone ?? "" };
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values: echo };
  if (kind === "host" && !canCreateHosts()) {
    return { ok: false, message: "Host registration isn't available yet: the server is missing part of its configuration. Please contact support.", values: echo };
  }

  const v = parsed.data;
  const landing = safeNextPath(values.next, defaultLanding(kind));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      data: { full_name: v.full_name, phone: v.phone ?? "" },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(landing)}`,
    },
  });
  if (error) {
    return { ok: false, message: error.message.toLowerCase().includes("already") ? ALREADY_REGISTERED : "We couldn't create your account. Please try again.", values: echo };
  }
  // With e-mail confirmation on, signing up an existing address returns a placeholder user with no identities: never touch it.
  if (!data.user || data.user.identities?.length === 0) return { ok: false, message: ALREADY_REGISTERED, values: echo };

  if (kind === "host" && !(await markNewAccountAsHost(data.user.id))) {
    return { ok: false, message: "Your account was created, but we couldn't set it up as a host. Verify your email, sign in, then use “List Your Property” to switch it to a host account.", values: echo };
  }
  // With e-mail confirmation on there is no session yet; otherwise the user is already signed in.
  if (data.session) redirect(landing);
  return {
    ok: true,
    message: "Account created. We've sent a verification link to your email — open it to activate your account" + (kind === "host" ? ", and you'll go straight to the listing steps." : "."),
  };
}

const ALREADY_REGISTERED = "An account with this email already exists. Try signing in, or use “Forgot your password?”. If you signed up with Google, choose Continue with Google.";

export async function signUpCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  return register("customer", formData);
}

export async function signUpHost(_prev: FormState, formData: FormData): Promise<FormState> {
  return register("host", formData);
}

/**
 * Starts Google sign-in. The intent (host vs customer) and destination are stored in an httpOnly cookie that only the server
 * reads in the callback; the redirect URL carries no role or destination, so it cannot be edited to ask for more.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) redirect("/sign-in?error=oauth_unavailable");
  const kind = formData.get("intent") === "host" ? "host" : "customer";
  const next = safeNextPath(String(formData.get("next") ?? ""), "");
  const jar = await cookies();
  jar.set(OAUTH_INTENT_COOKIE, serializeIntent(kind, next), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: OAUTH_INTENT_MAX_AGE_SECONDS,
  });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) {
    jar.delete(OAUTH_INTENT_COOKIE);
    redirect(`/sign-in?error=${/provider is not enabled|unsupported provider/i.test(error?.message ?? "") ? "oauth_unavailable" : "oauth_failed"}`);
  }
  redirect(data.url);
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  // Same answer whether or not the account exists (prevents account enumeration).
  return { ok: true, message: "If an account exists for that email, a password reset link is on its way." };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "This reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "We couldn't update your password. Please request a new reset link." };
  redirect("/dashboard?password=updated");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/");
}
