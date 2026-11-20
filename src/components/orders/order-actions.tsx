"use client";

import { useActionState } from "react";

import { cancelOrder, openDispute, requestReturn } from "@/app/dashboard/order-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function CancelOrderForm({ orderId, mode }: { orderId: string; mode: "now" | "request" }) {
  const [state, action] = useActionState(cancelOrder, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      {mode === "request" ? <Field label="Why do you want to cancel?" htmlFor="cancel-reason" hint="The seller has already accepted this order, so they decide on your request."><TextArea id="cancel-reason" name="reason" rows={3} maxLength={500} /></Field> : <p className="text-sm text-ink/70">The seller has not accepted yet, so you can cancel right away.</p>}
      <SubmitButton variant="danger" pendingLabel="Sending…" className="h-10">{mode === "now" ? "Cancel this order" : "Request cancellation"}</SubmitButton>
    </form>
  );
}

export function ReturnForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(requestReturn, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      <Field label="Request type" htmlFor="return-kind"><NativeSelect id="return-kind" name="kind" defaultValue={state.values?.kind ?? "return"}><option value="return">Return</option><option value="replacement">Replacement</option></NativeSelect></Field>
      <Field label="What went wrong?" htmlFor="return-reason" required error={state.fieldErrors?.reason}><TextArea id="return-reason" name="reason" rows={2} maxLength={500} defaultValue={state.values?.reason} /></Field>
      <Field label="More details (optional)" htmlFor="return-details"><TextArea id="return-details" name="details" rows={3} maxLength={2000} defaultValue={state.values?.details} /></Field>
      <SubmitButton pendingLabel="Sending…" className="h-10">Send request</SubmitButton>
    </form>
  );
}

export function DisputeForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(openDispute, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      <Field label="Describe the problem" htmlFor="dispute-desc" required error={state.fieldErrors?.description}><TextArea id="dispute-desc" name="description" rows={4} maxLength={3000} defaultValue={state.values?.description} /></Field>
      <SubmitButton variant="outline" pendingLabel="Sending…" className="h-10">Send to our team</SubmitButton>
    </form>
  );
}
