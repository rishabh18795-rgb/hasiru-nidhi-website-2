"use client";

import { useActionState } from "react";

import { cancelServiceRequest, decideQuotation } from "@/app/dashboard/service-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function CancelRequestForm({ requestId, accepted }: { requestId: string; accepted: boolean }) {
  const [state, action] = useActionState(cancelServiceRequest, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      <Field label="Why do you want to cancel? (optional)" htmlFor="cr-reason" hint={accepted ? "The provider will be told. Nothing has been charged, so there is no fee." : undefined}><TextArea id="cr-reason" name="reason" rows={2} maxLength={1000} defaultValue={state.values?.reason} /></Field>
      <SubmitButton variant="danger" pendingLabel="Cancelling…" className="h-10">Cancel this request</SubmitButton>
    </form>
  );
}

export function QuotationDecisionForm({ quotationId, requestId }: { quotationId: string; requestId: string }) {
  const [state, action] = useActionState(decideQuotation, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="quotation_id" value={quotationId} />
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      <Field label="Your decision" htmlFor={`qd-${quotationId}`}>
        <NativeSelect id={`qd-${quotationId}`} name="decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? "accept"}><option value="accept">Accept this quotation</option><option value="decline">Decline it</option></NativeSelect>
      </Field>
      <Field label="Note to the provider (optional)" htmlFor={`qn-${quotationId}`}><TextArea id={`qn-${quotationId}`} name="note" rows={2} maxLength={1000} defaultValue={state.values?.note} /></Field>
      <SubmitButton pendingLabel="Saving…" className="h-10">Send my decision</SubmitButton>
      <p className="text-xs text-ink/55">Accepting agrees the quoted amount and shares your phone and address with the provider. Nothing is charged: payment is not configured yet.</p>
    </form>
  );
}
