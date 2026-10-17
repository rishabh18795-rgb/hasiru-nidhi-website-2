"use client";

import { startTransition, useActionState, useState } from "react";

import { createEnquiryUploadTickets, submitGardeningEnquiry } from "@/app/gardening-landscaping/actions";
import type { FormState } from "@/lib/action";
import { CheckboxField, Field, Honeypot, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ENQUIRY_PHOTO_LIMITS, gardeningPropertyTypes, gardeningServices } from "@/lib/validation/enquiries";

const initial: FormState = {};
const BUDGETS = ["Under ₹25,000", "₹25,000 – ₹50,000", "₹50,000 – ₹1,00,000", "₹1,00,000 – ₹3,00,000", "Above ₹3,00,000", "Not sure yet"];

export function GardeningQuoteForm() {
  const [state, action] = useActionState(submitGardeningEnquiry, initial);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const e = state?.fieldErrors ?? {};

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setUploadError(null);
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const files = (fd.getAll("photos") as File[]).filter((f) => f && f.size > 0);
    fd.delete("photos");

    if (files.length) {
      if (files.length > ENQUIRY_PHOTO_LIMITS.maxFiles) return setUploadError(`Attach up to ${ENQUIRY_PHOTO_LIMITS.maxFiles} photos.`);
      setBusy(true);
      try {
        const res = await createEnquiryUploadTickets(files.map((f) => ({ type: f.type, size: f.size })));
        if (!res.ok) return setUploadError(res.message);
        const supabase = createBrowserSupabase();
        if (!supabase) return setUploadError("Photo upload isn't available right now.");
        for (let i = 0; i < files.length; i++) {
          const { error } = await supabase.storage.from("enquiry-photos").uploadToSignedUrl(res.tickets[i].path, res.tickets[i].token, files[i]);
          if (error) return setUploadError(`Couldn't upload “${files[i].name}”. Please try again or remove the photo.`);
          fd.append("photo_path", res.tickets[i].path);
        }
      } finally {
        setBusy(false);
      }
    }
    startTransition(() => action(fd));
  }

  if (state?.ok) return <FormMessage state={state} />;

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-5" noValidate>
      <Honeypot />
      <FormMessage state={state} />
      {uploadError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{uploadError}</p> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="g-name" error={e.name} required><TextInput id="g-name" name="name" autoComplete="name" defaultValue={state?.values?.name} error={!!e.name} /></Field>
        <Field label="Phone" htmlFor="g-phone" error={e.phone}><TextInput id="g-phone" name="phone" type="tel" autoComplete="tel" defaultValue={state?.values?.phone} placeholder="+91 98765 43210" error={!!e.phone} /></Field>
        <Field label="Email" htmlFor="g-email" error={e.email} hint="Phone or email — at least one."><TextInput id="g-email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} error={!!e.email} /></Field>
        <Field label="Project location" htmlFor="g-location" error={e.location} required><TextInput id="g-location" name="location" defaultValue={state?.values?.location} placeholder="Area, city" error={!!e.location} /></Field>
        <Field label="Property type" htmlFor="g-type" error={e.property_type} required>
          <NativeSelect id="g-type" name="property_type" defaultValue={state?.values?.property_type ?? ""} error={!!e.property_type}>
            <option value="" disabled>Choose one</option>
            {gardeningPropertyTypes.map((t) => <option key={t}>{t}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Approximate garden size" htmlFor="g-size" error={e.garden_size} hint="e.g. 600 sq ft terrace, 2 guntha lawn"><TextInput id="g-size" name="garden_size" defaultValue={state?.values?.garden_size} maxLength={80} /></Field>
      </div>
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-forest-950">What do you need?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {gardeningServices.map((s) => <CheckboxField key={s.value} name="services" value={s.value} id={`svc-${s.value}`} label={s.label} />)}
        </div>
      </fieldset>
      <Field label="Budget range" htmlFor="g-budget" error={e.budget_range}>
        <NativeSelect id="g-budget" name="budget_range" defaultValue={state?.values?.budget_range ?? ""}>
          <option value="">Prefer not to say</option>
          {BUDGETS.map((b) => <option key={b}>{b}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Tell us about your space" htmlFor="g-req" error={e.requirements}><TextArea id="g-req" name="requirements" rows={5} maxLength={4000} defaultValue={state?.values?.requirements} placeholder="Sunlight, existing plants, style you like, timeline…" /></Field>
      <Field label="Photos of the space (optional)" htmlFor="g-photos" hint="Up to 5 images (JPEG, PNG, WebP), 5 MB each.">
        <input id="g-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm text-ink/70 file:mr-4 file:rounded-full file:border-0 file:bg-forest-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-forest-800 hover:file:bg-forest-100" />
      </Field>
      <SubmitButton disabled={busy} pendingLabel="Sending…" className="self-start">{busy ? "Uploading photos…" : "Request a quote"}</SubmitButton>
      <p className="text-xs text-ink/55">We use these details only to respond to your enquiry. See our <a href="/privacy" className="underline">Privacy Policy</a>.</p>
    </form>
  );
}
