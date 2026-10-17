"use client";

import { useActionState } from "react";
import Link from "next/link";

import { submitPartnerApplication } from "@/app/list-your-property/actions";
import type { FormState } from "@/lib/action";
import { CheckboxField, Field, Honeypot, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};
const CATEGORIES = ["Farm stay", "Village homestay", "Cottage", "Eco-retreat", "Family getaway / villa", "Cycling-friendly stay", "Other"];

export function PartnerApplicationForm() {
  const [state, action] = useActionState(submitPartnerApplication, initial);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="relative flex flex-col gap-5" noValidate>
      <Honeypot />
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Owner's full name" htmlFor="p-owner" error={e.owner_name} required><TextInput id="p-owner" name="owner_name" autoComplete="name" defaultValue={v.owner_name} error={!!e.owner_name} /></Field>
        <Field label="Phone number" htmlFor="p-phone" error={e.phone} required><TextInput id="p-phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} placeholder="+91 98765 43210" error={!!e.phone} /></Field>
        <Field label="Email" htmlFor="p-email" error={e.email} required className="sm:col-span-2"><TextInput id="p-email" name="email" type="email" autoComplete="email" defaultValue={v.email} error={!!e.email} /></Field>
        <Field label="Property name" htmlFor="p-name" error={e.property_name} required className="sm:col-span-2"><TextInput id="p-name" name="property_name" defaultValue={v.property_name} error={!!e.property_name} /></Field>
        <Field label="City / town" htmlFor="p-city" error={e.city} required><TextInput id="p-city" name="city" defaultValue={v.city} error={!!e.city} /></Field>
        <Field label="State" htmlFor="p-state" error={e.state}><TextInput id="p-state" name="state" defaultValue={v.state ?? "Karnataka"} /></Field>
        <Field label="Property type" htmlFor="p-cat" error={e.category}>
          <NativeSelect id="p-cat" name="category" defaultValue={v.category ?? ""}><option value="">Choose one</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-5">
          <Field label="Rooms" htmlFor="p-rooms" error={e.rooms_count}><TextInput id="p-rooms" name="rooms_count" type="number" min={1} max={200} defaultValue={v.rooms_count} /></Field>
          <Field label="Max guests" htmlFor="p-guests" error={e.max_guests}><TextInput id="p-guests" name="max_guests" type="number" min={1} max={500} defaultValue={v.max_guests} /></Field>
        </div>
        <Field label="Tell us about the property" htmlFor="p-desc" error={e.description} className="sm:col-span-2"><TextArea id="p-desc" name="description" rows={4} maxLength={3000} defaultValue={v.description} placeholder="Setting, facilities, activities you offer…" /></Field>
        <Field label="Currently listed on (if any)" htmlFor="p-plat" hint="e.g. Airbnb, Booking.com, direct only"><TextInput id="p-plat" name="current_platforms" defaultValue={v.current_platforms} maxLength={300} /></Field>
        <Field label="Preferred partnership model" htmlFor="p-model" hint="e.g. commission per booking, annual fee, not sure"><TextInput id="p-model" name="partnership_model" defaultValue={v.partnership_model} maxLength={300} /></Field>
      </div>
      <CheckboxField name="consent" error={e.consent} label={<>I agree that Hasiru Nidhi may contact me about listing my property, and I&apos;ve read the <Link href="/privacy" className="underline">Privacy Policy</Link> and <Link href="/terms" className="underline">Terms</Link>.</>} />
      <SubmitButton pendingLabel="Sending…" className="self-start">Send application</SubmitButton>
      <p className="text-xs text-ink/55">Prefer to upload photographs and manage your listing yourself? <Link href="/sign-up?type=host" className="underline">Create a host account</Link> instead.</p>
    </form>
  );
}
