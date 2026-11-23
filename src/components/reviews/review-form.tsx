"use client";

import { useActionState } from "react";

import { submitReview } from "@/app/dashboard/review-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ReviewForm({ kind, refId, back, subject }: { kind: "product" | "service"; refId: string; back: string; subject: string }) {
  const [state, action] = useActionState(submitReview, initial);
  const id = `rv-${refId.slice(0, 8)}`;
  if (state.ok) return <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">{state.message}</p>;
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="ref" value={refId} />
      <input type="hidden" name="back" value={back} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Rating" htmlFor={`${id}-rating`} required error={state.fieldErrors?.rating}>
          <NativeSelect id={`${id}-rating`} name="rating" defaultValue={state.values?.rating ?? ""} aria-label={`Rating for ${subject}`}>
            <option value="">Choose…</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Title (optional)" htmlFor={`${id}-title`} error={state.fieldErrors?.title}><TextInput id={`${id}-title`} name="title" maxLength={100} defaultValue={state.values?.title} /></Field>
      </div>
      <Field label="Your review" htmlFor={`${id}-body`} required error={state.fieldErrors?.body} hint="Share what it was like. Reviews are checked by our team before they appear, and your first name is shown.">
        <TextArea id={`${id}-body`} name="body" rows={3} maxLength={2000} defaultValue={state.values?.body} />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Sending…" className="h-10">Submit review</SubmitButton>
    </form>
  );
}
