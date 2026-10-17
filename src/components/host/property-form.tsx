"use client";

import { useActionState } from "react";

import { saveProperty } from "@/app/host/actions";
import type { FormState } from "@/lib/action";
import type { Catalog } from "@/lib/data/catalog";
import { CheckboxField, Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { cancellationPolicies, priceUnits } from "@/lib/validation/property";
import Link from "next/link";

export interface PropertyInitial {
  id?: string;
  name?: string; category_id?: number | null; summary?: string | null; description?: string;
  city?: string | null; state?: string | null; region?: string | null; postal_code?: string | null;
  rooms_count?: number; max_guests?: number; price_inr?: number | null; price_unit?: string;
  check_in_time?: string; check_out_time?: string; house_rules?: string | null; cancellation_policy?: string;
  amenity_ids?: number[]; experience_ids?: number[];
  address_line?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null;
  current_platforms?: string | null; partnership_model?: string | null; terms_accepted?: boolean;
}

const initialState: FormState = {};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-forest-900/10 bg-white p-6">
      <legend className="px-2 font-display text-xl text-forest-950">{title}</legend>
      {hint ? <p className="-mt-1 mb-4 text-sm text-ink/60">{hint}</p> : null}
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function PropertyForm({ initial, catalog, readOnlyNotice }: { initial: PropertyInitial; catalog: Catalog; readOnlyNotice?: string }) {
  const [state, action] = useActionState(saveProperty, initialState);
  const e = state?.fieldErrors ?? {};
  const val = (k: keyof PropertyInitial, fallback = ""): string => {
    const fromState = state?.values?.[k as string];
    if (fromState !== undefined) return fromState;
    const v = initial[k];
    return v === null || v === undefined ? fallback : String(v);
  };
  const editing = Boolean(initial.id);
  const amenitySet = new Set(initial.amenity_ids ?? []);
  const experienceSet = new Set(initial.experience_ids ?? []);

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {editing ? <input type="hidden" name="id" value={initial.id} /> : null}
      {readOnlyNotice ? <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">{readOnlyNotice}</p> : null}
      <FormMessage state={state} />

      <Section title="Basics">
        <Field label="Property name" htmlFor="name" error={e.name} required className="sm:col-span-2">
          <TextInput id="name" name="name" defaultValue={val("name")} maxLength={120} error={!!e.name} />
        </Field>
        <Field label="Category" htmlFor="category_id" error={e.category_id} required>
          <NativeSelect id="category_id" name="category_id" defaultValue={val("category_id")} error={!!e.category_id}>
            <option value="" disabled>Choose a category</option>
            {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="One-line summary" htmlFor="summary" error={e.summary} hint="Shown on search cards (max 240 characters).">
          <TextInput id="summary" name="summary" defaultValue={val("summary")} maxLength={240} error={!!e.summary} />
        </Field>
        <Field label="Description" htmlFor="description" error={e.description} hint="At least 50 characters are needed to submit for review. Describe only what is true." required className="sm:col-span-2">
          <TextArea id="description" name="description" rows={7} maxLength={8000} defaultValue={val("description")} error={!!e.description} />
        </Field>
      </Section>

      <Section title="Location" hint="City, region and state are public. The street address is kept private and shared only after a confirmed booking.">
        <Field label="City / town" htmlFor="city" error={e.city} required><TextInput id="city" name="city" defaultValue={val("city")} error={!!e.city} /></Field>
        <Field label="Region / district" htmlFor="region" error={e.region}><TextInput id="region" name="region" defaultValue={val("region")} /></Field>
        <Field label="State" htmlFor="state" error={e.state} required><TextInput id="state" name="state" defaultValue={val("state", "Karnataka")} error={!!e.state} /></Field>
        <Field label="PIN code" htmlFor="postal_code" error={e.postal_code}><TextInput id="postal_code" name="postal_code" defaultValue={val("postal_code")} inputMode="numeric" maxLength={10} /></Field>
      </Section>

      <Section title="Capacity & pricing" hint="Pricing is indicative. Leave the price empty to show “Price on request”.">
        <Field label="Number of rooms" htmlFor="rooms_count" error={e.rooms_count} required><TextInput id="rooms_count" name="rooms_count" type="number" min={1} max={200} defaultValue={val("rooms_count", "1")} error={!!e.rooms_count} /></Field>
        <Field label="Maximum guests" htmlFor="max_guests" error={e.max_guests} required><TextInput id="max_guests" name="max_guests" type="number" min={1} max={500} defaultValue={val("max_guests", "2")} error={!!e.max_guests} /></Field>
        <Field label="Price (₹)" htmlFor="price_inr" error={e.price_inr}><TextInput id="price_inr" name="price_inr" type="number" min={0} step="1" defaultValue={val("price_inr")} error={!!e.price_inr} /></Field>
        <Field label="Price applies" htmlFor="price_unit" error={e.price_unit}>
          <NativeSelect id="price_unit" name="price_unit" defaultValue={val("price_unit", "per_night")}>
            {priceUnits.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </NativeSelect>
        </Field>
      </Section>

      <Section title="Rules & policies">
        <Field label="Check-in time" htmlFor="check_in_time" error={e.check_in_time}><TextInput id="check_in_time" name="check_in_time" type="time" defaultValue={val("check_in_time", "14:00").slice(0, 5)} /></Field>
        <Field label="Check-out time" htmlFor="check_out_time" error={e.check_out_time}><TextInput id="check_out_time" name="check_out_time" type="time" defaultValue={val("check_out_time", "11:00").slice(0, 5)} /></Field>
        <Field label="Cancellation policy" htmlFor="cancellation_policy" className="sm:col-span-2">
          <NativeSelect id="cancellation_policy" name="cancellation_policy" defaultValue={val("cancellation_policy", "moderate")}>
            {cancellationPolicies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="House rules" htmlFor="house_rules" error={e.house_rules} className="sm:col-span-2">
          <TextArea id="house_rules" name="house_rules" rows={4} maxLength={3000} defaultValue={val("house_rules")} />
        </Field>
      </Section>

      <fieldset className="rounded-2xl border border-forest-900/10 bg-white p-6">
        <legend className="px-2 font-display text-xl text-forest-950">Facilities &amp; experiences</legend>
        <p className="mb-3 text-sm font-medium text-forest-950">Facilities</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.amenities.map((a) => <CheckboxField key={a.id} name="amenity_ids" value={String(a.id)} id={`am-${a.id}`} label={a.name} defaultChecked={amenitySet.has(a.id)} />)}
        </div>
        <p className="mb-3 mt-6 text-sm font-medium text-forest-950">Experiences &amp; activities you offer</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.experiences.map((x) => <CheckboxField key={x.id} name="experience_ids" value={String(x.id)} id={`ex-${x.id}`} label={x.name} defaultChecked={experienceSet.has(x.id)} />)}
        </div>
      </fieldset>

      <Section title="Private owner details" hint="Visible only to you and Hasiru Nidhi administrators. Required to submit your listing.">
        <Field label="Street address" htmlFor="address_line" error={e.address_line} required className="sm:col-span-2"><TextInput id="address_line" name="address_line" defaultValue={val("address_line")} maxLength={300} /></Field>
        <Field label="Contact person" htmlFor="contact_name" error={e.contact_name}><TextInput id="contact_name" name="contact_name" defaultValue={val("contact_name")} autoComplete="name" /></Field>
        <Field label="Contact phone" htmlFor="contact_phone" error={e.contact_phone} required><TextInput id="contact_phone" name="contact_phone" type="tel" defaultValue={val("contact_phone")} autoComplete="tel" error={!!e.contact_phone} /></Field>
        <Field label="Contact email" htmlFor="contact_email" error={e.contact_email}><TextInput id="contact_email" name="contact_email" type="email" defaultValue={val("contact_email")} autoComplete="email" error={!!e.contact_email} /></Field>
        <Field label="Currently listed on (if any)" htmlFor="current_platforms" hint="e.g. Airbnb, Booking.com, direct only"><TextInput id="current_platforms" name="current_platforms" defaultValue={val("current_platforms")} maxLength={300} /></Field>
        <Field label="Preferred partnership model" htmlFor="partnership_model" className="sm:col-span-2" hint="e.g. commission per confirmed booking, annual listing fee — to be agreed with Hasiru Nidhi."><TextInput id="partnership_model" name="partnership_model" defaultValue={val("partnership_model")} maxLength={300} /></Field>
      </Section>

      <div className="rounded-2xl border border-forest-900/10 bg-white p-6">
        <CheckboxField
          name="accept_terms"
          defaultChecked={Boolean(initial.terms_accepted)}
          label={<>I confirm the information is accurate and I agree to the <Link href="/terms" className="underline">platform terms</Link> for hosts. I understand the listing is reviewed before it goes live.</>}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Save draft & continue to photos"}</SubmitButton>
        <Link href="/host/properties" className="text-sm text-ink/65 underline underline-offset-2">Cancel</Link>
      </div>
    </form>
  );
}
