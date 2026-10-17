"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { FormState } from "@/lib/action";
import { requestPasswordReset, resetPassword, signIn, signUp } from "@/app/auth/actions";
import { CheckboxField, Field, NativeSelect, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email} required>
        <TextInput id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} error={!!state?.fieldErrors?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} required>
        <TextInput id="password" name="password" type="password" autoComplete="current-password" error={!!state?.fieldErrors?.password} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-forest-700 underline underline-offset-2 hover:text-forest-900">
          Forgot your password?
        </Link>
      </div>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm({ defaultType }: { defaultType: "traveller" | "host" }) {
  const [state, action] = useActionState(signUp, initial);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="I want to" htmlFor="account_type" error={e.account_type} required>
        <NativeSelect id="account_type" name="account_type" defaultValue={v.account_type ?? defaultType}>
          <option value="traveller">Find and book stays (traveller)</option>
          <option value="host">List my property (host)</option>
        </NativeSelect>
      </Field>
      <Field label="Full name" htmlFor="full_name" error={e.full_name} required>
        <TextInput id="full_name" name="full_name" autoComplete="name" defaultValue={v.full_name} error={!!e.full_name} />
      </Field>
      <Field label="Email" htmlFor="email" error={e.email} required>
        <TextInput id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} error={!!e.email} />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={e.phone} hint="Shared with a host only when you send them a booking request.">
        <TextInput id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} placeholder="+91 98765 43210" error={!!e.phone} />
      </Field>
      <Field label="Password" htmlFor="password" error={e.password} hint="At least 10 characters with upper-case, lower-case and a number." required>
        <TextInput id="password" name="password" type="password" autoComplete="new-password" error={!!e.password} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm_password" error={e.confirm_password} required>
        <TextInput id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" error={!!e.confirm_password} />
      </Field>
      <CheckboxField
        name="accept_terms"
        error={e.accept_terms}
        label={
          <>
            I agree to the <Link href="/terms" className="underline">Terms</Link> and{" "}
            <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </>
        }
      />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email} required>
        <TextInput id="email" name="email" type="email" autoComplete="email" error={!!state?.fieldErrors?.email} />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, initial);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password" error={e.password} hint="At least 10 characters with upper-case, lower-case and a number." required>
        <TextInput id="password" name="password" type="password" autoComplete="new-password" error={!!e.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm_password" error={e.confirm_password} required>
        <TextInput id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" error={!!e.confirm_password} />
      </Field>
      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
