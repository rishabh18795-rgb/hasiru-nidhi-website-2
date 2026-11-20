"use client";

import { useActionState } from "react";

import { saveAddress } from "@/app/cart/actions";
import type { FormState } from "@/lib/action";
import type { CustomerAddress } from "@/lib/db/types";
import { Field, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function AddressForm({ address, submitLabel = "Save address", defaultChecked }: { address?: CustomerAddress; submitLabel?: string; defaultChecked?: boolean }) {
  const [state, action] = useActionState(saveAddress, initial);
  const id = address?.id ?? "new";
  const v = (k: keyof CustomerAddress, f = "") => (state.ok ? f : state.values?.[k] ?? ((address?.[k] as string | null) ?? f));
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <Field label="Full name" htmlFor={`an-${id}`} required error={err("full_name")}><TextInput id={`an-${id}`} name="full_name" autoComplete="name" defaultValue={v("full_name")} error={Boolean(err("full_name"))} /></Field>
      <Field label="Phone" htmlFor={`ap-${id}`} required error={err("phone")} hint="The seller sees it only after accepting your order."><TextInput id={`ap-${id}`} name="phone" type="tel" autoComplete="tel" defaultValue={v("phone")} error={Boolean(err("phone"))} /></Field>
      <Field label="House, building and street" htmlFor={`a1-${id}`} required error={err("line1")} className="sm:col-span-2"><TextInput id={`a1-${id}`} name="line1" autoComplete="address-line1" defaultValue={v("line1")} error={Boolean(err("line1"))} /></Field>
      <Field label="Area or apartment (optional)" htmlFor={`a2-${id}`} error={err("line2")}><TextInput id={`a2-${id}`} name="line2" autoComplete="address-line2" defaultValue={v("line2")} /></Field>
      <Field label="Landmark (optional)" htmlFor={`al-${id}`} error={err("landmark")}><TextInput id={`al-${id}`} name="landmark" defaultValue={v("landmark")} /></Field>
      <Field label="City or town" htmlFor={`ac-${id}`} required error={err("city")}><TextInput id={`ac-${id}`} name="city" autoComplete="address-level2" defaultValue={v("city")} error={Boolean(err("city"))} /></Field>
      <Field label="State" htmlFor={`as-${id}`} required error={err("state")}><TextInput id={`as-${id}`} name="state" autoComplete="address-level1" defaultValue={v("state")} error={Boolean(err("state"))} /></Field>
      <Field label="PIN code" htmlFor={`az-${id}`} required error={err("postal_code")} hint="Sellers deliver only to the PIN codes they serve."><TextInput id={`az-${id}`} name="postal_code" inputMode="numeric" maxLength={6} autoComplete="postal-code" defaultValue={v("postal_code")} error={Boolean(err("postal_code"))} /></Field>
      <Field label="Label (optional)" htmlFor={`ab-${id}`} error={err("label")} hint="For example Home or Office."><TextInput id={`ab-${id}`} name="label" maxLength={40} defaultValue={v("label")} /></Field>
      <label className="flex items-center gap-2 text-sm text-ink/80 sm:col-span-2"><input type="checkbox" name="is_default" defaultChecked={address?.is_default ?? defaultChecked} className="h-4 w-4 accent-forest-700" /> Use as my default address</label>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton></div>
    </form>
  );
}
