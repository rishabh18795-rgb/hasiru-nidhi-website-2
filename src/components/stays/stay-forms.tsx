"use client";

import { useActionState } from "react";

import { contactAboutProperty, reportListing } from "@/app/stays/actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ReportForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState(reportListing, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="mt-3 flex flex-col gap-3" noValidate>
      <input type="hidden" name="property_id" value={propertyId} />
      <FormMessage state={state} />
      <Field label="Reason" htmlFor="report-reason" error={state?.fieldErrors?.reason} required>
        <NativeSelect id="report-reason" name="reason" defaultValue="">
          <option value="" disabled>Choose a reason</option>
          <option>Inaccurate photos or description</option>
          <option>Suspected scam or fraud</option>
          <option>Offensive or inappropriate content</option>
          <option>Safety concern</option>
          <option>Other</option>
        </NativeSelect>
      </Field>
      <Field label="Details (optional)" htmlFor="report-details">
        <TextArea id="report-details" name="details" rows={3} maxLength={3000} />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Submitting…">Submit report</SubmitButton>
    </form>
  );
}

export function ContactHostForm({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [state, action] = useActionState(contactAboutProperty, initial);
  const e = state?.fieldErrors ?? {};
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="mt-3 flex flex-col gap-3" noValidate>
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="subject" value={`Question about ${propertyName}`} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <FormMessage state={state} />
      <Field label="Your name" htmlFor="ch-name" error={e.name} required>
        <TextInput id="ch-name" name="name" autoComplete="name" defaultValue={state?.values?.name} error={!!e.name} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" htmlFor="ch-email" error={e.email}>
          <TextInput id="ch-email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} error={!!e.email} />
        </Field>
        <Field label="Phone" htmlFor="ch-phone" error={e.phone}>
          <TextInput id="ch-phone" name="phone" type="tel" autoComplete="tel" defaultValue={state?.values?.phone} error={!!e.phone} />
        </Field>
      </div>
      <Field label="Your question" htmlFor="ch-message" error={e.message} required>
        <TextArea id="ch-message" name="message" rows={4} maxLength={5000} defaultValue={state?.values?.message} error={!!e.message} />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}
