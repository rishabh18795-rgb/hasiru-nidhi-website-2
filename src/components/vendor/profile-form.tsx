"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { saveVendorProfile } from "@/app/vendor/actions";
import type { FormState } from "@/lib/action";
import type { Vendor, VendorCapabilityKind } from "@/lib/db/types";
import { BUSINESS_TYPES, CAPABILITY_INFO } from "@/lib/validation/vendor";
import { CheckboxField, Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { cn } from "@/lib/utils";

const initial: FormState = {};

function IntentButton({ intent, children, primary }: { intent: "save" | "submit"; children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2 disabled:opacity-60",
        primary ? "bg-forest-800 text-cream hover:bg-forest-700" : "border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50",
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/**
 * The vendor business profile and application. Draft or rejected: everything is editable and the application can be submitted.
 * Approved: the business name, type and tax identifier are locked (the database enforces this too).
 */
export function VendorProfileForm({ vendor, requested }: { vendor: Vendor | null; requested: VendorCapabilityKind[] }) {
  const [state, action] = useActionState(saveVendorProfile, initial);
  const v = (name: keyof Vendor) => state.values?.[name] ?? ((vendor?.[name] as string | null) ?? "");
  const err = (name: string) => state.fieldErrors?.[name];
  const locked = vendor?.status === "approved";
  const canSubmit = !vendor || vendor.status === "draft" || vendor.status === "rejected";
  const ro = locked ? { readOnly: true, className: "bg-forest-50/60" } : {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      {locked ? <p className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Your business is verified, so the business name, type and tax identifier are locked. To change them, contact support. You can update your contact details below.</p> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="business_name" required error={err("business_name")} className="sm:col-span-2">
          <TextInput id="business_name" name="business_name" defaultValue={v("business_name")} maxLength={120} error={Boolean(err("business_name"))} {...ro} />
        </Field>
        <Field label="Business type" htmlFor="business_type" required error={err("business_type")}>
          {locked ? <><input type="hidden" name="business_type" value={v("business_type")} /><TextInput id="business_type" readOnly defaultValue={BUSINESS_TYPES.find((b) => b.value === v("business_type"))?.label ?? ""} className="bg-forest-50/60" /></> : (
            <NativeSelect id="business_type" name="business_type" defaultValue={v("business_type")} error={Boolean(err("business_type"))}>
              <option value="">Choose…</option>
              {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </NativeSelect>
          )}
        </Field>
        <Field label="Tax identifier (optional)" htmlFor="tax_identifier" hint="As you declare it, for example a GST number. It is not verified or used to calculate anything yet." error={err("tax_identifier")}>
          <TextInput id="tax_identifier" name="tax_identifier" defaultValue={v("tax_identifier")} maxLength={40} {...ro} />
        </Field>
        <Field label="About your business" htmlFor="description" error={err("description")} className="sm:col-span-2">
          <TextArea id="description" name="description" rows={4} defaultValue={v("description")} maxLength={2000} />
        </Field>
        <Field label="Contact name" htmlFor="contact_name" required error={err("contact_name")}>
          <TextInput id="contact_name" name="contact_name" autoComplete="name" defaultValue={v("contact_name")} error={Boolean(err("contact_name"))} />
        </Field>
        <Field label="Contact phone" htmlFor="contact_phone" required error={err("contact_phone")}>
          <TextInput id="contact_phone" name="contact_phone" type="tel" autoComplete="tel" defaultValue={v("contact_phone")} error={Boolean(err("contact_phone"))} />
        </Field>
        <Field label="Contact email" htmlFor="contact_email" required error={err("contact_email")} className="sm:col-span-2">
          <TextInput id="contact_email" name="contact_email" type="email" autoComplete="email" defaultValue={v("contact_email")} error={Boolean(err("contact_email"))} />
        </Field>
        <Field label="Business address" htmlFor="address_line" required error={err("address_line")} className="sm:col-span-2">
          <TextInput id="address_line" name="address_line" autoComplete="street-address" defaultValue={v("address_line")} error={Boolean(err("address_line"))} />
        </Field>
        <Field label="City" htmlFor="city" required error={err("city")}>
          <TextInput id="city" name="city" defaultValue={v("city")} error={Boolean(err("city"))} />
        </Field>
        <Field label="State" htmlFor="state" required error={err("state")}>
          <TextInput id="state" name="state" defaultValue={v("state")} error={Boolean(err("state"))} />
        </Field>
        <Field label="PIN code" htmlFor="postal_code" required error={err("postal_code")}>
          <TextInput id="postal_code" name="postal_code" inputMode="numeric" maxLength={6} autoComplete="postal-code" defaultValue={v("postal_code")} error={Boolean(err("postal_code"))} />
        </Field>
      </div>

      {canSubmit ? (
        <fieldset className="rounded-2xl border border-forest-900/10 bg-forest-50/40 p-5">
          <legend className="px-2 font-display text-lg text-forest-950">What would you like to do?</legend>
          <p className="mb-3 text-sm text-ink/65">Each one is reviewed and approved separately. You can ask for more later.</p>
          <div className="flex flex-col gap-3">
            {(Object.keys(CAPABILITY_INFO) as VendorCapabilityKind[]).map((k) => (
              <CheckboxField key={k} name="capabilities" value={k} id={`cap-${k}`} defaultChecked={requested.includes(k)}
                label={<><span className="font-medium text-forest-950">{CAPABILITY_INFO[k].label}.</span> {CAPABILITY_INFO[k].help}</>} />
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canSubmit ? (
          <>
            <IntentButton intent="save">Save draft</IntentButton>
            <IntentButton intent="submit" primary>Submit application</IntentButton>
          </>
        ) : (
          <IntentButton intent="save" primary>Save changes</IntentButton>
        )}
      </div>
      {canSubmit ? <p className="text-xs text-ink/65">Submitting needs a complete profile and any documents our team requires for what you chose (see Verification). We do not promise approval, and nothing is public until you are verified and each listing is approved.</p> : null}
    </form>
  );
}
