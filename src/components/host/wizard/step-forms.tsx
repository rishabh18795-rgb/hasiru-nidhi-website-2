"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";

import { saveWizardStep } from "@/app/host/actions";
import type { FormState } from "@/lib/action";
import type { Catalog } from "@/lib/data/catalog";
import { CheckboxField, Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { PricingPreview } from "@/components/host/wizard/pricing-preview";
import { cn } from "@/lib/utils";
import { ARRANGEMENTS, PRICING_MODELS, cancellationOptions } from "@/lib/wizard/schemas";
import { WIZARD_STEPS, previousStep, stepIndex, wizardPath, type WizardStepKey } from "@/lib/wizard/steps";
import type { PricingRules } from "@/lib/pricing";

/** What the server loaded for this step: plain strings / numbers / id lists. */
export type StepInitial = Record<string, string | number | null | undefined | number[]>;

const noState: FormState = {};

function useStep() {
  return useActionState(saveWizardStep, noState);
}

function reader(state: FormState, initial: StepInitial) {
  return (key: string, fallback = ""): string => {
    const echoed = state?.values?.[key];
    if (echoed !== undefined) return echoed;
    const v = initial[key];
    return v === null || v === undefined || Array.isArray(v) ? fallback : String(v);
  };
}

function Buttons({ propertyId, step, saveLabel = "Save draft", continueLabel }: { propertyId?: string; step: WizardStepKey; saveLabel?: string; continueLabel?: string }) {
  const { pending } = useFormStatus();
  const prev = previousStep(step);
  const last = stepIndex(step) === WIZARD_STEPS.length - 1;
  const base = "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40 disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-forest-900/10 pt-5">
      {prev && propertyId ? (
        <Link href={wizardPath(propertyId, prev)} className={cn(base, "border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
      ) : <span />}
      <div className="flex flex-wrap items-center gap-3">
        {/* formNoValidate: saving a draft must never be blocked by "required" fields that aren't filled in yet. */}
        <button type="submit" name="intent" value="save" formNoValidate disabled={pending} className={cn(base, "border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50")}>
          <Save className="h-4 w-4" aria-hidden="true" /> {saveLabel}
        </button>
        <button type="submit" name="intent" value="continue" disabled={pending} className={cn(base, "bg-forest-800 text-cream hover:bg-forest-700")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {continueLabel ?? (last ? "Save & review" : "Save & continue")}
          {!pending ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
        </button>
      </div>
    </div>
  );
}

function Frame({ propertyId, step, state, action, children, continueLabel }: { propertyId?: string; step: WizardStepKey; state: FormState; action: (fd: FormData) => void; children: React.ReactNode; continueLabel?: string }) {
  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Pressing Enter in a field should mean "Continue", so a (hidden) Continue button comes first in the DOM. */}
      <button type="submit" name="intent" value="continue" tabIndex={-1} aria-hidden="true" className="sr-only" />
      <input type="hidden" name="step" value={step} />
      {propertyId ? <input type="hidden" name="property_id" value={propertyId} /> : null}
      <FormMessage state={state} />
      {children}
      <Buttons propertyId={propertyId} step={step} continueLabel={continueLabel} />
    </form>
  );
}

function Section({ title, hint, children, cols = 2 }: { title?: string; hint?: string; children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <fieldset className="rounded-2xl border border-forest-900/10 bg-white p-5 sm:p-6">
      {title ? <legend className="px-2 font-display text-xl text-forest-950">{title}</legend> : null}
      {hint ? <p className={cn("mb-4 text-sm text-ink/60", title && "-mt-1")}>{hint}</p> : null}
      <div className={cn("grid gap-5", cols === 2 && "sm:grid-cols-2")}>{children}</div>
    </fieldset>
  );
}

/* --------------------------------------------------------------------------- 1. type */
export function TypeStep({ propertyId, initial, catalog }: { propertyId?: string; initial: StepInitial; catalog: Catalog }) {
  const [state, action] = useStep();
  const v = reader(state, initial);
  const e = state?.fieldErrors ?? {};
  return (
    <Frame propertyId={propertyId} step="type" state={state} action={action} continueLabel="Save & continue">
      <Section title="What kind of place is it?" cols={1}>
        <Field label="Property name" htmlFor="name" error={e.name} required hint="The name guests will see. Use the real name of your property.">
          <TextInput id="name" name="name" defaultValue={v("name")} maxLength={120} minLength={3} required error={!!e.name} autoComplete="off" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-forest-950">Property type <span aria-hidden="true" className="text-red-600">*</span></legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.categories.map((c) => (
              <label key={c.id} className="group relative flex cursor-pointer flex-col rounded-xl border border-forest-900/15 bg-white p-4 text-sm transition-colors hover:bg-forest-50 has-[:checked]:border-forest-700 has-[:checked]:bg-forest-50 has-[:checked]:ring-2 has-[:checked]:ring-forest-700/30">
                <input type="radio" name="category_id" value={c.id} defaultChecked={v("category_id") === String(c.id)} required className="sr-only" />
                <span className="font-medium text-forest-950">{c.name}</span>
                {c.description ? <span className="mt-1 text-xs text-ink/60">{c.description}</span> : null}
              </label>
            ))}
          </div>
          {e.category_id?.length ? <p role="alert" className="mt-2 text-xs text-red-600">{e.category_id[0]}</p> : null}
        </fieldset>
      </Section>
    </Frame>
  );
}

/* --------------------------------------------------------------------------- 2. location */
export function LocationStep({ propertyId, initial }: { propertyId: string; initial: StepInitial }) {
  const [state, action] = useStep();
  const v = reader(state, initial);
  const e = state?.fieldErrors ?? {};
  const lat = v("latitude");
  const lng = v("longitude");
  const mapOk = lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  return (
    <Frame propertyId={propertyId} step="location" state={state} action={action}>
      <Section title="Where is the property?" hint="Guests see the area (town, district, state). The street address is private and is shared only with a guest after you confirm their booking.">
        <Field label="Country" htmlFor="country" error={e.country} required><TextInput id="country" name="country" defaultValue={v("country", "India")} required minLength={2} maxLength={80} error={!!e.country} /></Field>
        <Field label="State" htmlFor="state" error={e.state} required><TextInput id="state" name="state" defaultValue={v("state", "Karnataka")} required minLength={2} maxLength={120} error={!!e.state} /></Field>
        <Field label="City or town" htmlFor="city" error={e.city} required><TextInput id="city" name="city" defaultValue={v("city")} required minLength={2} maxLength={120} error={!!e.city} /></Field>
        <Field label="Region / district (optional)" htmlFor="region" error={e.region}><TextInput id="region" name="region" defaultValue={v("region")} maxLength={120} /></Field>
        <Field label="Postal code" htmlFor="postal_code" error={e.postal_code} required hint="For India, the 6-digit PIN code."><TextInput id="postal_code" name="postal_code" defaultValue={v("postal_code")} required inputMode="numeric" minLength={3} maxLength={10} error={!!e.postal_code} /></Field>
        <Field label="Full address (private)" htmlFor="address_line" error={e.address_line} required className="sm:col-span-2" hint="Visible only to you and Hasiru Nidhi administrators.">
          <TextInput id="address_line" name="address_line" defaultValue={v("address_line")} required minLength={5} maxLength={300} autoComplete="street-address" error={!!e.address_line} />
        </Field>
      </Section>

      <Section title="Map pin" hint="Optional. In Google Maps, right-click your property and choose the coordinates at the top of the menu to copy them.">
        <Field label="Latitude" htmlFor="latitude" error={e.latitude}><TextInput id="latitude" name="latitude" defaultValue={lat} inputMode="decimal" placeholder="e.g. 12.295810" error={!!e.latitude} /></Field>
        <Field label="Longitude" htmlFor="longitude" error={e.longitude}><TextInput id="longitude" name="longitude" defaultValue={lng} inputMode="decimal" placeholder="e.g. 76.639381" error={!!e.longitude} /></Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-forest-950">What do guests see on the map? <span aria-hidden="true" className="text-red-600">*</span></legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { value: "approximate", title: "Approximate area (recommended)", copy: "The pin is rounded to roughly 1 km. Your exact spot stays private until a booking is confirmed." },
              { value: "exact", title: "Exact location", copy: "The precise pin is shown on your listing page." },
            ].map((o) => (
              <label key={o.value} className="flex cursor-pointer flex-col rounded-xl border border-forest-900/15 bg-white p-4 text-sm hover:bg-forest-50 has-[:checked]:border-forest-700 has-[:checked]:bg-forest-50 has-[:checked]:ring-2 has-[:checked]:ring-forest-700/30">
                <input type="radio" name="location_precision" value={o.value} defaultChecked={v("location_precision", "approximate") === o.value} required className="sr-only" />
                <span className="font-medium text-forest-950">{o.title}</span>
                <span className="mt-1 text-xs text-ink/60">{o.copy}</span>
              </label>
            ))}
          </div>
          {e.location_precision?.length ? <p role="alert" className="mt-2 text-xs text-red-600">{e.location_precision[0]}</p> : null}
        </fieldset>
        {mapOk ? (
          <div className="sm:col-span-2 overflow-hidden rounded-xl border border-forest-900/10">
            <iframe title="Map preview of the entered coordinates" src={`https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=13&output=embed`} className="h-56 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        ) : null}
      </Section>
    </Frame>
  );
}

/* --------------------------------------------------------------------------- 3. details */
export function DetailsStep({ propertyId, initial }: { propertyId: string; initial: StepInitial }) {
  const [state, action] = useStep();
  const v = reader(state, initial);
  const e = state?.fieldErrors ?? {};
  const [desc, setDesc] = useState(v("description"));
  return (
    <Frame propertyId={propertyId} step="details" state={state} action={action}>
      <Section title="About the property" cols={1}>
        <Field label="One-line summary (optional)" htmlFor="summary" error={e.summary} hint="Shown on search cards (up to 240 characters)."><TextInput id="summary" name="summary" defaultValue={v("summary")} maxLength={240} error={!!e.summary} /></Field>
        <Field label="Description" htmlFor="description" error={e.description} required hint={`Describe only what is true — guests rely on it. ${desc.trim().length}/50 characters minimum.`}>
          <TextArea id="description" name="description" rows={8} required minLength={50} maxLength={8000} defaultValue={v("description")} onChange={(ev) => setDesc(ev.target.value)} error={!!e.description} />
        </Field>
      </Section>
      <Section title="Rooms and capacity">
        <Field label="Number of rooms" htmlFor="rooms_count" error={e.rooms_count} required><TextInput id="rooms_count" name="rooms_count" type="number" min={1} max={200} step={1} defaultValue={v("rooms_count", "1")} required error={!!e.rooms_count} /></Field>
        <Field label="Maximum guests" htmlFor="max_guests" error={e.max_guests} required><TextInput id="max_guests" name="max_guests" type="number" min={1} max={500} step={1} defaultValue={v("max_guests", "2")} required error={!!e.max_guests} /></Field>
        <Field label="Bedrooms" htmlFor="bedrooms" error={e.bedrooms} required><TextInput id="bedrooms" name="bedrooms" type="number" min={0} max={100} step={1} defaultValue={v("bedrooms")} required error={!!e.bedrooms} /></Field>
        <Field label="Beds" htmlFor="beds" error={e.beds} required><TextInput id="beds" name="beds" type="number" min={0} max={300} step={1} defaultValue={v("beds")} required error={!!e.beds} /></Field>
        <Field label="Bathrooms" htmlFor="bathrooms" error={e.bathrooms} required hint="Use .5 for a half bath."><TextInput id="bathrooms" name="bathrooms" type="number" min={0} max={100} step={0.5} defaultValue={v("bathrooms")} required error={!!e.bathrooms} /></Field>
        <Field label="Accommodation arrangement" htmlFor="accommodation_arrangement" error={e.accommodation_arrangement} required>
          <NativeSelect id="accommodation_arrangement" name="accommodation_arrangement" defaultValue={v("accommodation_arrangement")} required error={!!e.accommodation_arrangement}>
            <option value="" disabled>Choose…</option>
            {ARRANGEMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </NativeSelect>
        </Field>
      </Section>
      <Section title="Check-in, check-out and house rules">
        <Field label="Check-in from" htmlFor="check_in_time" error={e.check_in_time} required><TextInput id="check_in_time" name="check_in_time" type="time" defaultValue={v("check_in_time", "14:00").slice(0, 5)} required /></Field>
        <Field label="Check-out by" htmlFor="check_out_time" error={e.check_out_time} required><TextInput id="check_out_time" name="check_out_time" type="time" defaultValue={v("check_out_time", "11:00").slice(0, 5)} required /></Field>
        <Field label="House rules (optional)" htmlFor="house_rules" error={e.house_rules} className="sm:col-span-2" hint="e.g. quiet hours, smoking, pets, visitors."><TextArea id="house_rules" name="house_rules" rows={4} maxLength={3000} defaultValue={v("house_rules")} /></Field>
      </Section>
    </Frame>
  );
}

/* --------------------------------------------------------------------------- 5. amenities */
export function AmenitiesStep({ propertyId, initial, catalog }: { propertyId: string; initial: StepInitial; catalog: Catalog }) {
  const [state, action] = useStep();
  const amenitySet = new Set((initial.amenity_ids as number[] | undefined) ?? []);
  const experienceSet = new Set((initial.experience_ids as number[] | undefined) ?? []);
  const groups = [...new Set(catalog.amenities.map((a) => a.group_name))];
  return (
    <Frame propertyId={propertyId} step="amenities" state={state} action={action}>
      <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">Tick only what your property really offers. These are your own statements; nothing is selected for you, and our team may ask you to confirm them.</p>
      {groups.map((g) => (
        <fieldset key={g} className="rounded-2xl border border-forest-900/10 bg-white p-5 sm:p-6">
          <legend className="px-2 font-display text-lg capitalize text-forest-950">{g.replace(/_/g, " ")}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.amenities.filter((a) => a.group_name === g).map((a) => <CheckboxField key={a.id} name="amenity_ids" value={String(a.id)} id={`am-${a.id}`} label={a.name} defaultChecked={amenitySet.has(a.id)} />)}
          </div>
        </fieldset>
      ))}
      <fieldset className="rounded-2xl border border-forest-900/10 bg-white p-5 sm:p-6">
        <legend className="px-2 font-display text-lg text-forest-950">Experiences &amp; activities you offer</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.experiences.map((x) => <CheckboxField key={x.id} name="experience_ids" value={String(x.id)} id={`ex-${x.id}`} label={x.name} defaultChecked={experienceSet.has(x.id)} />)}
        </div>
      </fieldset>
      <p className="text-sm text-ink/60">Something missing? <Link href="/contact" className="underline">Ask us to add it</Link> — administrators manage this list.</p>
    </Frame>
  );
}

/* --------------------------------------------------------------------------- 6. pricing */
export function PricingStep({ propertyId, initial, maxGuests }: { propertyId: string; initial: StepInitial; maxGuests: number }) {
  const [state, action] = useStep();
  const v = reader(state, initial);
  const e = state?.fieldErrors ?? {};
  const [unit, setUnit] = useState(v("price_unit", "per_night"));
  const [f, setF] = useState({
    price: v("price_inr"), weekend: v("weekend_price_inr"), included: v("included_guests"), extra: v("extra_guest_fee_inr"),
    cleaning: v("cleaning_fee_inr"), tax: v("tax_percent", "0"),
  });
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: ev.target.value }));
  const n = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
  const rules: PricingRules = {
    price_inr: n(f.price), price_unit: unit === "per_person_night" ? "per_person_night" : "per_night", weekend_price_inr: n(f.weekend),
    included_guests: n(f.included), extra_guest_fee_inr: n(f.extra), cleaning_fee_inr: n(f.cleaning), tax_percent: n(f.tax) ?? 0,
  };
  return (
    <Frame propertyId={propertyId} step="pricing" state={state} action={action}>
      <Section title="Pricing model" hint="Prices are in Indian rupees (₹). Per-room pricing isn't available yet: each confirmed booking reserves the whole property for its dates.">
        <Field label="How do you charge?" htmlFor="price_unit" error={e.price_unit} required className="sm:col-span-2">
          <NativeSelect id="price_unit" name="price_unit" value={unit} onChange={(ev) => setUnit(ev.target.value)} required>
            {PRICING_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label={unit === "per_person_night" ? "Price per guest, per night (₹)" : "Price per night (₹)"} htmlFor="price_inr" error={e.price_inr} required>
          <TextInput id="price_inr" name="price_inr" type="number" min={1} max={10000000} step="any" value={f.price} onChange={set("price")} required error={!!e.price_inr} />
        </Field>
        <Field label="Weekend price (₹, optional)" htmlFor="weekend_price_inr" error={e.weekend_price_inr} hint="Replaces the nightly price on Friday and Saturday nights.">
          <TextInput id="weekend_price_inr" name="weekend_price_inr" type="number" min={0} max={10000000} step="any" value={f.weekend} onChange={set("weekend")} error={!!e.weekend_price_inr} />
        </Field>
      </Section>

      {unit === "per_night" ? (
        <Section title="Additional guests" hint="Optional. Charge extra when more guests than the price includes stay.">
          <Field label="Guests included in the price" htmlFor="included_guests" error={e.included_guests}><TextInput id="included_guests" name="included_guests" type="number" min={1} max={500} step={1} value={f.included} onChange={set("included")} error={!!e.included_guests} /></Field>
          <Field label="Charge per extra guest, per night (₹)" htmlFor="extra_guest_fee_inr" error={e.extra_guest_fee_inr}><TextInput id="extra_guest_fee_inr" name="extra_guest_fee_inr" type="number" min={0} step="any" value={f.extra} onChange={set("extra")} error={!!e.extra_guest_fee_inr} /></Field>
        </Section>
      ) : (
        <>
          <input type="hidden" name="included_guests" value="" />
          <input type="hidden" name="extra_guest_fee_inr" value="" />
        </>
      )}

      <Section title="Fees, taxes and stay length">
        <Field label="Cleaning fee (₹, optional)" htmlFor="cleaning_fee_inr" error={e.cleaning_fee_inr} hint="Charged once per stay."><TextInput id="cleaning_fee_inr" name="cleaning_fee_inr" type="number" min={0} step="any" value={f.cleaning} onChange={set("cleaning")} error={!!e.cleaning_fee_inr} /></Field>
        <Field label="Taxes (%)" htmlFor="tax_percent" error={e.tax_percent} hint="Only enter a tax you actually charge (for example GST). Leave 0 if prices are tax-inclusive."><TextInput id="tax_percent" name="tax_percent" type="number" min={0} max={40} step="0.01" value={f.tax} onChange={set("tax")} error={!!e.tax_percent} /></Field>
        <Field label="Minimum stay (nights)" htmlFor="min_nights" error={e.min_nights} required><TextInput id="min_nights" name="min_nights" type="number" min={1} max={30} step={1} defaultValue={v("min_nights", "1")} required error={!!e.min_nights} /></Field>
        <Field label="Maximum stay (nights)" htmlFor="max_nights" error={e.max_nights} required hint="Online requests are limited to 30 nights."><TextInput id="max_nights" name="max_nights" type="number" min={1} max={30} step={1} defaultValue={v("max_nights", "30")} required error={!!e.max_nights} /></Field>
        <p className="text-sm text-ink/60 sm:col-span-2">Currency: Indian rupee (₹). Other currencies are not supported yet.</p>
      </Section>

      <PricingPreview rules={rules} maxGuests={maxGuests} />
    </Frame>
  );
}

/* --------------------------------------------------------------------------- 8. policies */
export function PoliciesStep({ propertyId, initial }: { propertyId: string; initial: StepInitial }) {
  const [state, action] = useStep();
  const v = reader(state, initial);
  const e = state?.fieldErrors ?? {};
  return (
    <Frame propertyId={propertyId} step="review" state={state} action={action} continueLabel="Save policies">
      <Section title="Cancellation policy" cols={1}>
        <Field label="Policy guests will see" htmlFor="cancellation_policy" error={e.cancellation_policy} required hint="Applied to confirmed bookings. Have it checked by a legal adviser if unsure.">
          <NativeSelect id="cancellation_policy" name="cancellation_policy" defaultValue={v("cancellation_policy", "moderate")} required>
            {cancellationOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </NativeSelect>
        </Field>
      </Section>
      <Section title="Private contact details" hint="Visible only to you and Hasiru Nidhi administrators, to reach you about this listing.">
        <Field label="Contact person" htmlFor="contact_name" error={e.contact_name} required><TextInput id="contact_name" name="contact_name" defaultValue={v("contact_name")} required minLength={2} maxLength={120} autoComplete="name" error={!!e.contact_name} /></Field>
        <Field label="Contact phone" htmlFor="contact_phone" error={e.contact_phone} required><TextInput id="contact_phone" name="contact_phone" type="tel" defaultValue={v("contact_phone")} required autoComplete="tel" placeholder="+91 98765 43210" error={!!e.contact_phone} /></Field>
        <Field label="Contact email (optional)" htmlFor="contact_email" error={e.contact_email}><TextInput id="contact_email" name="contact_email" type="email" defaultValue={v("contact_email")} autoComplete="email" error={!!e.contact_email} /></Field>
        <Field label="Currently listed on (optional)" htmlFor="current_platforms" hint="e.g. Airbnb, Booking.com, direct only"><TextInput id="current_platforms" name="current_platforms" defaultValue={v("current_platforms")} maxLength={300} /></Field>
        <Field label="Preferred partnership model (optional)" htmlFor="partnership_model" className="sm:col-span-2" hint="Any commission or fee is agreed with Hasiru Nidhi directly before your listing goes live."><TextInput id="partnership_model" name="partnership_model" defaultValue={v("partnership_model")} maxLength={300} /></Field>
      </Section>
      <Section title="Declarations" cols={1}>
        <CheckboxField name="accept_terms" error={e.accept_terms} defaultChecked={v("accept_terms") === "on" || initial.accept_terms === 1}
          label={<>I confirm the information in this listing is accurate and I agree to the <Link href="/terms" className="underline">platform terms</Link> for hosts. I understand it is reviewed before it goes live.</>} />
        <CheckboxField name="accept_photo_rights" error={e.accept_photo_rights} defaultChecked={v("accept_photo_rights") === "on" || initial.accept_photo_rights === 1}
          label="I took these photographs or have the right to use them, and they show this property as it really is." />
      </Section>
    </Frame>
  );
}

