"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth";
import { formValues, zodFieldErrors, type FormState } from "@/lib/action";
import { forgotSchema, resetSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { siteConfig } from "@/lib/site";

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

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(values);
  const echo = { full_name: values.full_name ?? "", email: values.email ?? "", phone: values.phone ?? "", account_type: values.account_type ?? "traveller" };
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values: echo };

  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      // account_type is limited to traveller|host by the schema AND by the database trigger.
      data: { full_name: v.full_name, phone: v.phone ?? "", account_type: v.account_type },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(v.account_type === "host" ? "/host" : "/dashboard")}`,
    },
  });
  if (error) {
    return { ok: false, message: error.message.toLowerCase().includes("already") ? "An account with this email already exists. Try signing in." : "We couldn't create your account. Please try again.", values: echo };
  }
  // With e-mail confirmation on, there is no session yet; otherwise the user is already signed in.
  if (data.session) redirect(v.account_type === "host" ? "/host" : "/dashboard");
  return {
    ok: true,
    message: "Account created. We've sent a verification link to your email — open it to activate your account, then sign in.",
  };
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
