"use client";

import { useActionState } from "react";

import { addServiceCategory, adminCancelServiceRequest, reviewService, updateServiceCategory } from "@/app/admin/service-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ServiceDecisionForm({ serviceId, status }: { serviceId: string; status: string }) {
  const [state, action] = useActionState(reviewService, initial);
  const options: { value: string; label: string }[] =
    status === "pending_review" ? [{ value: "approve", label: "Approve (makes it public when Services is open)" }, { value: "request_changes", label: "Request changes (reason required)" }, { value: "reject", label: "Reject (reason required)" }]
    : status === "approved" ? [{ value: "suspend", label: "Suspend / hide (reason required)" }]
    : status === "suspended" ? [{ value: "reinstate", label: "Reinstate" }]
    : [];
  if (!options.length) return <p className="text-sm text-ink/65">Nothing to decide: this service is {status.replace("_", " ")}.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="service_id" value={serviceId} />
      <FormMessage state={state} />
      <Field label="Decision" htmlFor="service-decision"><NativeSelect id="service-decision" name="decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? options[0].value}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field label="Reason / note to the provider" htmlFor="service-reason" hint="Required for changes, rejection and suspension. The provider sees this."><TextArea id="service-reason" name="reason" rows={3} maxLength={1000} defaultValue={state.values?.reason} /></Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Apply decision</SubmitButton>
    </form>
  );
}

export function AdminCancelRequestForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(adminCancelServiceRequest, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      <Field label="Reason (required, recorded in the audit log)" htmlFor="ac-reason" required><TextArea id="ac-reason" name="reason" rows={2} maxLength={1000} defaultValue={state.values?.reason} /></Field>
      <SubmitButton variant="danger" pendingLabel="Cancelling…" className="h-10">Cancel this request</SubmitButton>
    </form>
  );
}

export function AddServiceCategoryForm() {
  const [state, action] = useActionState(addServiceCategory, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Field label="Category name" htmlFor="scat-name" required error={state.fieldErrors?.name}><TextInput id="scat-name" name="name" maxLength={80} defaultValue={state.ok ? "" : state.values?.name} /></Field>
      <Field label="Description (optional)" htmlFor="scat-desc" error={state.fieldErrors?.description}><TextInput id="scat-desc" name="description" maxLength={400} defaultValue={state.ok ? "" : state.values?.description} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Adding…">Add category</SubmitButton></div>
    </form>
  );
}

export function EditServiceCategoryForm({ id, name, description, isActive }: { id: number; name: string; description: string | null; isActive: boolean }) {
  const [state, action] = useActionState(updateServiceCategory, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <label className="text-xs text-ink/65">Name<TextInput name="name" defaultValue={name} maxLength={80} className="mt-1 h-9 text-sm" aria-label={`Name of ${name}`} /></label>
      <label className="text-xs text-ink/65">Description<TextInput name="description" defaultValue={description ?? ""} maxLength={400} className="mt-1 h-9 text-sm" aria-label={`Description of ${name}`} /></label>
      <label className="text-xs text-ink/65">Visibility
        <NativeSelect name="is_active" defaultValue={String(isActive)} className="mt-1 h-9 text-sm" aria-label={`Visibility of ${name}`}><option value="true">Shown</option><option value="false">Disabled (hidden)</option></NativeSelect>
      </label>
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Save</SubmitButton>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={`text-xs sm:col-span-4 ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}

import { moderateReview } from "@/app/admin/review-actions";

export function ReviewModerationForm({ reviewId, status }: { reviewId: string; status: string }) {
  const [state, action] = useActionState(moderateReview, initial);
  const options = status === "approved" ? [{ v: "reject", l: "Hide it (reason required)" }] : status === "rejected" ? [{ v: "approve", l: "Approve after all" }] : [{ v: "approve", l: "Approve (makes it public)" }, { v: "reject", l: "Do not publish (reason required)" }];
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="review_id" value={reviewId} />
      <select name="decision" aria-label="Decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? options[0].v} className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
      <input name="note" aria-label="Reason" placeholder="Reason (if needed)" maxLength={500} defaultValue={state.values?.note} className="h-9 min-w-40 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Apply</SubmitButton>
      {state.message ? <span role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}
