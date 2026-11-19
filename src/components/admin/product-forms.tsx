"use client";

import { useActionState } from "react";

import { addProductCategory, reviewProduct, updateProductCategory } from "@/app/admin/product-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ProductDecisionForm({ productId, status }: { productId: string; status: string }) {
  const [state, action] = useActionState(reviewProduct, initial);
  const options: { value: string; label: string }[] =
    status === "pending_review" ? [{ value: "approve", label: "Approve (makes it public when the Shop is open)" }, { value: "request_changes", label: "Request changes (reason required)" }, { value: "reject", label: "Reject (reason required)" }]
    : status === "approved" ? [{ value: "suspend", label: "Suspend / hide (reason required)" }]
    : status === "suspended" ? [{ value: "reinstate", label: "Reinstate" }]
    : [];
  if (!options.length) return <p className="text-sm text-ink/60">Nothing to decide: this product is {status.replace("_", " ")}.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="product_id" value={productId} />
      <FormMessage state={state} />
      <Field label="Decision" htmlFor="product-decision"><NativeSelect id="product-decision" name="decision" defaultValue={options[0].value}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field label="Reason / note to the seller" htmlFor="product-reason" hint="Required for changes, rejection and suspension. The seller sees this."><TextArea id="product-reason" name="reason" rows={3} maxLength={1000} /></Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Apply decision</SubmitButton>
    </form>
  );
}

export function AddCategoryForm() {
  const [state, action] = useActionState(addProductCategory, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Field label="Category name" htmlFor="cat-name" required error={state.fieldErrors?.name}><TextInput id="cat-name" name="name" maxLength={80} defaultValue={state.ok ? "" : state.values?.name} /></Field>
      <Field label="Description (optional)" htmlFor="cat-desc" error={state.fieldErrors?.description}><TextInput id="cat-desc" name="description" maxLength={400} defaultValue={state.ok ? "" : state.values?.description} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Adding…">Add category</SubmitButton></div>
    </form>
  );
}

export function EditCategoryForm({ id, name, description, isActive }: { id: number; name: string; description: string | null; isActive: boolean }) {
  const [state, action] = useActionState(updateProductCategory, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <label className="text-xs text-ink/60">Name<TextInput name="name" defaultValue={name} maxLength={80} className="mt-1 h-9 text-sm" aria-label={`Name of ${name}`} /></label>
      <label className="text-xs text-ink/60">Description<TextInput name="description" defaultValue={description ?? ""} maxLength={400} className="mt-1 h-9 text-sm" aria-label={`Description of ${name}`} /></label>
      <label className="text-xs text-ink/60">Visibility
        <NativeSelect name="is_active" defaultValue={String(isActive)} className="mt-1 h-9 text-sm" aria-label={`Visibility of ${name}`}><option value="true">Shown</option><option value="false">Disabled (hidden)</option></NativeSelect>
      </label>
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Save</SubmitButton>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={`text-xs sm:col-span-4 ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}
