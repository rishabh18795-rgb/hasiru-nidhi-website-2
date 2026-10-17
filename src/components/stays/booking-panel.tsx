"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import { requestStay } from "@/app/stays/actions";
import type { FormState } from "@/lib/action";
import { Field, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatINR, nightsBetween, PRICE_UNIT_LABEL } from "@/lib/format";

interface Props {
  propertyId: string;
  slug: string;
  maxGuests: number;
  price: number | null;
  priceUnit: string;
  minDate: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  viewer: "anonymous" | "traveller" | "owner" | "other_host";
}

const initial: FormState = {};

export function BookingPanel({ propertyId, slug, maxGuests, price, priceUnit, minDate, initialCheckIn = "", initialCheckOut = "", initialGuests, viewer }: Props) {
  const [state, action] = useActionState(requestStay, initial);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [adults, setAdults] = useState(initialGuests && initialGuests <= maxGuests ? initialGuests : 2);
  const [children, setChildren] = useState(0);
  const e = state?.fieldErrors ?? {};

  const estimate = useMemo(() => {
    if (price === null || !checkIn || !checkOut || checkOut <= checkIn) return null;
    const nights = nightsBetween(checkIn, checkOut);
    const guests = adults + children;
    const total = priceUnit === "per_night" ? price * nights : priceUnit === "per_person_night" ? price * nights * guests : price * guests;
    return { nights, total };
  }, [price, priceUnit, checkIn, checkOut, adults, children]);

  return (
    <div id="booking" className="rounded-3xl border border-forest-900/10 bg-white p-6 shadow-lg shadow-forest-950/5 lg:sticky lg:top-28">
      <div className="flex items-baseline justify-between">
        {price !== null ? (
          <p><span className="font-display text-2xl text-forest-950">{formatINR(price)}</span> <span className="text-sm text-ink/55">{PRICE_UNIT_LABEL[priceUnit]}</span></p>
        ) : (
          <p className="font-display text-xl text-forest-950">Price on request</p>
        )}
      </div>

      {viewer === "owner" ? (
        <p className="mt-5 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">This is your listing. Manage requests from the host portal.</p>
      ) : viewer === "anonymous" ? (
        <div className="mt-5">
          <p className="text-sm text-ink/70">Sign in to send the host a booking request. It&apos;s a request — nothing is charged and nothing is confirmed until the host accepts.</p>
          <Link href={`/sign-in?next=${encodeURIComponent(`/stays/${slug}${checkIn && checkOut ? `?checkin=${checkIn}&checkout=${checkOut}` : ""}`)}`} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-forest-800 text-sm font-medium text-cream hover:bg-forest-700">
            Sign in to request
          </Link>
          <p className="mt-3 text-center text-xs text-ink/55">
            New here? <Link href={`/sign-up?next=/stays/${slug}`} className="underline">Create an account</Link>
          </p>
        </div>
      ) : (
        <form action={action} className="mt-5 flex flex-col gap-4" noValidate>
          <input type="hidden" name="property_id" value={propertyId} />
          <FormMessage state={state} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in" htmlFor="check_in" error={e.check_in} required>
              <TextInput id="check_in" name="check_in" type="date" min={minDate} value={checkIn} onChange={(ev) => setCheckIn(ev.target.value)} error={!!e.check_in} />
            </Field>
            <Field label="Check-out" htmlFor="check_out" error={e.check_out} required>
              <TextInput id="check_out" name="check_out" type="date" min={checkIn || minDate} value={checkOut} onChange={(ev) => setCheckOut(ev.target.value)} error={!!e.check_out} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adults" htmlFor="adults" error={e.adults} required>
              <TextInput id="adults" name="adults" type="number" min={1} max={maxGuests} value={adults} onChange={(ev) => setAdults(Number(ev.target.value) || 0)} error={!!e.adults} />
            </Field>
            <Field label="Children" htmlFor="children" error={e.children}>
              <TextInput id="children" name="children" type="number" min={0} max={maxGuests} value={children} onChange={(ev) => setChildren(Number(ev.target.value) || 0)} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink/50">Sleeps up to {maxGuests} guests.</p>
          <Field label="Message to the host (optional)" htmlFor="message" error={e.message}>
            <TextArea id="message" name="message" rows={3} maxLength={2000} placeholder="Occasion, arrival time, dietary needs…" defaultValue={state?.values?.message} />
          </Field>
          {estimate ? (
            <div className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">
              <p className="flex justify-between"><span>{estimate.nights} night{estimate.nights === 1 ? "" : "s"}</span><strong>{formatINR(estimate.total)}</strong></p>
              <p className="mt-1 text-xs text-earth-600">Indicative only, based on the host&apos;s listed price. The host confirms the final amount.</p>
            </div>
          ) : null}
          <SubmitButton pendingLabel="Sending request…">Request to book</SubmitButton>
          <p className="text-center text-xs text-ink/55">You won&apos;t be charged. The host reviews your request first.</p>
        </form>
      )}
    </div>
  );
}
