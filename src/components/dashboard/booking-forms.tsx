"use client";

import { useActionState } from "react";

import { cancelMyBooking, submitReview, updateProfile } from "@/app/dashboard/actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function CancelBookingForm({ bookingId, policyText }: { bookingId: string; policyText: string }) {
  const [state, action] = useActionState(cancelMyBooking, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <details className="rounded-xl border border-forest-900/10 bg-stone-50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-red-700">Cancel this booking</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        <p className="text-xs leading-relaxed text-ink/65">Cancellation policy: {policyText}. Refunds (if any) are settled directly with the host under this policy.</p>
        <FormMessage state={state} />
        <TextArea name="note" aria-label="Reason (optional)" placeholder="Reason (optional)" rows={2} maxLength={1000} />
        <SubmitButton variant="danger" pendingLabel="Cancelling…" className="self-start">Confirm cancellation</SubmitButton>
      </form>
    </details>
  );
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(submitReview, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-forest-900/10 bg-stone-50 p-4">
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm font-medium text-forest-950">How was your stay?</p>
      <FormMessage state={state} />
      <Field label="Rating" htmlFor={`rating-${bookingId}`} error={state?.fieldErrors?.rating}>
        <NativeSelect id={`rating-${bookingId}`} name="rating" defaultValue="5">
          <option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option>
          <option value="2">2 — Poor</option><option value="1">1 — Terrible</option>
        </NativeSelect>
      </Field>
      <TextArea name="comment" aria-label="Your review" placeholder="Share what you liked (optional)" rows={3} maxLength={2000} />
      <SubmitButton pendingLabel="Posting…" className="self-start">Post review</SubmitButton>
    </form>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action] = useActionState(updateProfile, initial);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex max-w-lg flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email" hint="Your sign-in email can't be changed here.">
        <TextInput id="email" value={email} readOnly disabled />
      </Field>
      <Field label="Full name" htmlFor="full_name" error={e.full_name} required>
        <TextInput id="full_name" name="full_name" defaultValue={state?.values?.full_name ?? name} autoComplete="name" error={!!e.full_name} />
      </Field>
      <Field label="Phone" htmlFor="phone" error={e.phone} hint="Shared with a host only when you send them a booking request.">
        <TextInput id="phone" name="phone" type="tel" defaultValue={state?.values?.phone ?? phone} autoComplete="tel" error={!!e.phone} />
      </Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Save changes</SubmitButton>
    </form>
  );
}
