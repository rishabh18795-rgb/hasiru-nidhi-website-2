"use client";

import { useActionState } from "react";

import { addDocumentRequirement, reviewCapability, reviewVendor, reviewVendorDocument } from "@/app/admin/marketplace-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};
const reasonHint = "Required for rejection and suspension. The vendor sees this.";

export function VendorDecisionForm({ vendorId, status }: { vendorId: string; status: string }) {
  const [state, action] = useActionState(reviewVendor, initial);
  const options: { value: string; label: string }[] =
    status === "submitted" ? [{ value: "start_review", label: "Start review" }, { value: "approve", label: "Approve business" }, { value: "reject", label: "Request changes / reject (reason required)" }]
    : status === "under_review" ? [{ value: "approve", label: "Approve business" }, { value: "reject", label: "Request changes / reject (reason required)" }]
    : status === "approved" ? [{ value: "suspend", label: "Suspend vendor (reason required)" }]
    : status === "suspended" ? [{ value: "reinstate", label: "Reinstate" }]
    : [];
  if (!options.length) return <p className="text-sm text-ink/60">Nothing to decide at this stage{status === "draft" ? ": the vendor has not submitted yet" : status === "rejected" ? ": waiting for the vendor to resubmit" : ""}.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="vendor_id" value={vendorId} />
      <FormMessage state={state} />
      <Field label="Decision" htmlFor="vendor-decision"><NativeSelect id="vendor-decision" name="decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? options[0].value}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field label="Reason / note to the vendor" htmlFor="vendor-reason" hint={reasonHint}><TextArea id="vendor-reason" name="reason" rows={3} maxLength={1000} defaultValue={state.values?.reason} /></Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Apply decision</SubmitButton>
    </form>
  );
}

export function CapabilityDecisionForm({ vendorId, capability, status, vendorApproved }: { vendorId: string; capability: string; status: string; vendorApproved: boolean }) {
  const [state, action] = useActionState(reviewCapability, initial);
  const options: { value: string; label: string }[] =
    status === "pending" ? [{ value: "approve", label: "Approve" }, { value: "reject", label: "Reject (reason)" }]
    : status === "approved" ? [{ value: "suspend", label: "Suspend (reason)" }]
    : status === "suspended" ? [{ value: "reinstate", label: "Reinstate" }]
    : [];
  if (!options.length) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="capability" value={capability} />
      <select name="decision" aria-label={`Decision for ${capability}`} key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? options[0].value} className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <input name="reason" aria-label={`Reason for ${capability}`} placeholder="Reason (if needed)" maxLength={1000} defaultValue={state.values?.reason} className="h-9 min-w-40 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4" disabled={!vendorApproved && status === "pending"}>Apply</SubmitButton>
      {!vendorApproved && status === "pending" ? <span className="w-full text-xs text-ink/55">Approve the business first.</span> : null}
      {state?.message ? <span role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}

export function DocumentDecisionForm({ vendorId, documentId }: { vendorId: string; documentId: string }) {
  const [state, action] = useActionState(reviewVendorDocument, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="document_id" value={documentId} />
      <select name="decision" aria-label="Document decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? "accept"} className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm"><option value="accept">Accept</option><option value="reject">Reject (note)</option></select>
      <input name="note" aria-label="Note to the vendor" placeholder="Note (required to reject)" maxLength={1000} defaultValue={state.values?.note} className="h-9 min-w-40 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Apply</SubmitButton>
      {state?.message ? <span role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}

export function AddRequirementForm() {
  const [state, action] = useActionState(addDocumentRequirement, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Field label="Document name" htmlFor="req-name" error={state.fieldErrors?.name} required><TextInput id="req-name" name="name" maxLength={120} defaultValue={state.values?.name} /></Field>
      <Field label="Applies to" htmlFor="req-cap"><NativeSelect id="req-cap" name="capability" defaultValue="products"><option value="products">Products</option><option value="services">Services</option><option value="stays">Stays</option></NativeSelect></Field>
      <Field label="Instructions for the vendor (optional)" htmlFor="req-desc" className="sm:col-span-2"><TextInput id="req-desc" name="description" maxLength={500} defaultValue={state.values?.description} /></Field>
      <Field label="Needed to submit?" htmlFor="req-required"><NativeSelect id="req-required" name="is_required" defaultValue="true"><option value="true">Required before submitting</option><option value="false">Optional</option></NativeSelect></Field>
      <div className="flex items-end"><SubmitButton pendingLabel="Adding…">Add requirement</SubmitButton></div>
    </form>
  );
}
