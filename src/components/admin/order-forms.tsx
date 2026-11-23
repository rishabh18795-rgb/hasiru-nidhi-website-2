"use client";

import { useActionState } from "react";

import { adminCancelOrder, adminDecideRequest, resolveDispute, savePolicy } from "@/app/admin/order-actions";
import type { FormState } from "@/lib/action";
import type { CategoryPolicy } from "@/lib/db/types";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function AdminCancelForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(adminCancelOrder, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      <Field label="Reason (the customer and seller are told)" htmlFor="admin-cancel-reason" error={state.fieldErrors?.reason}><TextArea id="admin-cancel-reason" name="reason" rows={3} maxLength={500} /></Field>
      <SubmitButton variant="danger" pendingLabel="Cancelling…" className="h-10">Cancel this order</SubmitButton>
      <p className="text-xs text-ink/65">Only possible before dispatch. Stock is returned to the seller.</p>
    </form>
  );
}

export function AdminRequestForm({ requestId, orderId, kind, status }: { requestId: string; orderId: string; kind: string; status: string }) {
  const [state, action] = useActionState(adminDecideRequest, initial);
  const options = status === "requested" ? [["approve", "Approve"], ["reject", "Reject (note required)"]] : status === "approved" && kind !== "cancel" ? [["complete", "Mark as completed"]] : [];
  if (!options.length) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="order_id" value={orderId} />
      <select name="decision" aria-label="Decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? options[0][0]} className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input name="note" aria-label="Note" placeholder="Note" maxLength={1000} defaultValue={state.values?.note} className="h-9 min-w-40 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Apply</SubmitButton>
      {state.message ? <span role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}

export function DisputeResolveForm({ disputeId, orderId, status }: { disputeId: string; orderId: string; status: string }) {
  const [state, action] = useActionState(resolveDispute, initial);
  if (status === "resolved" || status === "dismissed") return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="dispute_id" value={disputeId} />
      <input type="hidden" name="order_id" value={orderId} />
      <select name="status" aria-label="Dispute status" key={String(state.values?.status ?? "")} defaultValue={state.values?.status ?? (status === "open" ? "in_review" : "resolved")} className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm"><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>
      <input name="resolution" aria-label="Resolution" placeholder="Resolution (required to close)" maxLength={2000} defaultValue={state.values?.resolution} className="h-9 min-w-48 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Update</SubmitButton>
      {state.message ? <span role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}

const tri = (v: boolean | null | undefined) => (v === null || v === undefined ? "" : String(v));
export function PolicyForm({ categoryId, name, policy }: { categoryId: number; name: string; policy: CategoryPolicy | null }) {
  const [state, action] = useActionState(savePolicy, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_1fr_8rem]">
      <input type="hidden" name="category_id" value={categoryId} />
      <label className="text-xs text-ink/65">Returns<NativeSelect name="returns_allowed" defaultValue={tri(policy?.returns_allowed)} className="mt-1 h-9 text-sm" aria-label={`Returns for ${name}`}><option value="">Not decided yet</option><option value="true">Accepted</option><option value="false">Not accepted</option></NativeSelect></label>
      <label className="text-xs text-ink/65">Return days<TextInput name="return_window_days" inputMode="numeric" defaultValue={policy?.return_window_days ?? ""} placeholder="No limit" className="mt-1 h-9 text-sm" aria-label={`Return window for ${name}`} /></label>
      <label className="text-xs text-ink/65">Replacements<NativeSelect name="replacements_allowed" defaultValue={tri(policy?.replacements_allowed)} className="mt-1 h-9 text-sm" aria-label={`Replacements for ${name}`}><option value="">Not decided yet</option><option value="true">Accepted</option><option value="false">Not accepted</option></NativeSelect></label>
      <label className="text-xs text-ink/65">Replacement days<TextInput name="replacement_window_days" inputMode="numeric" defaultValue={policy?.replacement_window_days ?? ""} placeholder="No limit" className="mt-1 h-9 text-sm" aria-label={`Replacement window for ${name}`} /></label>
      <label className="text-xs text-ink/65 sm:col-span-2 lg:col-span-3">Note shown to customers (optional)<TextInput name="notes" maxLength={500} defaultValue={policy?.notes ?? ""} className="mt-1 h-9 text-sm" aria-label={`Note for ${name}`} /></label>
      <div className="flex items-end"><SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Save</SubmitButton></div>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={`text-xs sm:col-span-2 lg:col-span-4 ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}
