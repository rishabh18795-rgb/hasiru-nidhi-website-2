"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import { requestStay } from "@/app/stays/actions";
import type { FormState } from "@/lib/action";
import { Field, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatINR, nightsBetween, PRICE_UNIT_LABEL } from "@/lib/format";
import { quoteLines, quoteStay, stayLengthProblem, type PricingRules } from "@/lib/pricing";
import { authHrefForBooking } from "@/lib/stays/booking-links";

interface Props {
  propertyId: string;
  slug: string;
  maxGuests: number;
  pricing: PricingRules;
  minNights: number;
  maxNights: number;
  minDate: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  viewer: "anonymous" | "traveller" | "owner" | "other_host";
}

const initial: FormState = {};

/** Rules the browser can check instantly. The server (request_booking) re-checks all of them and is the authority. */
export function bookingProblem(v: { checkIn: string; checkOut: string; adults: number; children: number; maxGuests: number; minNights: number; maxNights: number; today: string }): string | null {
  const guests = v.adults + v.children;
  if (v.adults < 1) return "At least one adult is needed.";
  if (guests > v.maxGuests) return `This property sleeps up to ${v.maxGuests} guest${v.maxGuests === 1 ? "" : "s"}.`;
  if (v.checkIn && v.checkIn < v.today) return "Check-in can't be in the past.";
  if (v.checkIn && v.checkOut && v.checkOut <= v.checkIn) return "Check-out must be after check-in.";
  if (v.checkIn && v.checkOut) return stayLengthProblem(nightsBetween(v.checkIn, v.checkOut), { min_nights: v.minNights, max_nights: v.maxNights });
  return null;
}

type Viewer = Props["viewer"] | "demo";

export function BookingPanel({ propertyId, slug, maxGuests, pricing, minNights, maxNights, minDate, initialCheckIn = "", initialCheckOut = "", initialGuests, viewer: viewerProp, demoNotice }: Omit<Props, "viewer"> & { viewer: Viewer; demoNotice?: boolean }) {
  const viewer = viewerProp;
  const [state, action] = useActionState(requestStay, initial);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [adults, setAdults] = useState(initialGuests && initialGuests <= maxGuests ? initialGuests : Math.min(2, maxGuests));
  const [children, setChildren] = useState(0);
  const [demoClicked, setDemoClicked] = useState(false);
  const e = state?.fieldErrors ?? {};

  const price = pricing.price_inr;
  const priceUnit = pricing.price_unit;
  // Same maths the database uses to price the stored booking (see lib/pricing.ts); the server re-checks everything.
  const problem = bookingProblem({ checkIn, checkOut, adults, children, maxGuests, minNights, maxNights, today: minDate });
  const quote = useMemo(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return null;
    return quoteStay(pricing, checkIn, checkOut, adults + children);
  }, [pricing, checkIn, checkOut, adults, children]);
  const nights = checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut) : 0;
  const selection = { checkin: checkIn, checkout: checkOut, guests: adults + children };
  const editable = viewer !== "owner";

  const fields = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in" htmlFor="check_in" error={e.check_in} required>
          <TextInput id="check_in" name="check_in" type="date" min={minDate} value={checkIn} onChange={(ev) => { setCheckIn(ev.target.value); setDemoClicked(false); }} error={!!e.check_in} />
        </Field>
        <Field label="Check-out" htmlFor="check_out" error={e.check_out} required>
          <TextInput id="check_out" name="check_out" type="date" min={checkIn || minDate} value={checkOut} onChange={(ev) => { setCheckOut(ev.target.value); setDemoClicked(false); }} error={!!e.check_out} />
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
      <p className="-mt-2 text-xs text-ink/50">Sleeps up to {maxGuests} guests. Stay of {minNights}–{maxNights} night{maxNights === 1 ? "" : "s"}.</p>
      {problem ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="booking-problem">{problem}</p> : null}
      {quote && !problem ? (
        <div className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800" aria-live="polite" data-testid="booking-quote">
          <p className="mb-1 font-medium">{nights} night{nights === 1 ? "" : "s"} · {adults + children} guest{adults + children === 1 ? "" : "s"}</p>
          <dl className="space-y-1">
            {quoteLines(quote).map((l) => <div key={l.label} className="flex justify-between gap-3"><dt>{l.label}</dt><dd>{formatINR(l.amount)}</dd></div>)}
          </dl>
          <p className="mt-2 flex justify-between border-t border-sand-300 pt-2 font-semibold"><span>{demoNotice ? "Illustrative total" : "Estimated total"}</span><strong data-testid="booking-total">{formatINR(quote.total)}</strong></p>
          <p className="mt-1 text-xs text-earth-600">{demoNotice ? "Demonstration prices. Nothing is charged." : "Based on the host\u2019s listed prices. The host confirms the final amount; nothing is charged online."}</p>
        </div>
      ) : null}
    </>
  );

  return (
    <div id="booking" className="rounded-3xl border border-forest-900/10 bg-white p-6 shadow-lg shadow-forest-950/5 lg:sticky lg:top-28">
      <div className="flex items-baseline justify-between">
        {price !== null ? (
          <p><span className="font-display text-2xl text-forest-950">{formatINR(price)}</span> <span className="text-sm text-ink/55">{PRICE_UNIT_LABEL[priceUnit]}</span>{demoNotice ? <span className="block text-[11px] font-medium uppercase tracking-wide text-amber-800">Illustrative demo price</span> : null}</p>
        ) : (
          <p className="font-display text-xl text-forest-950">Price on request</p>
        )}
      </div>

      {!editable ? (
        <p className="mt-5 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">This is your listing. Manage requests from the host portal.</p>
      ) : viewer === "demo" ? (
        <div className="mt-5 flex flex-col gap-4">
          {fields}
          <button type="button" disabled={Boolean(problem) || !checkIn || !checkOut} onClick={() => setDemoClicked(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60">
            Request to book (demo)
          </button>
          {demoClicked ? (
            <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="demo-booking-note">
              <strong>Demo mode — nothing was saved.</strong> No booking request was created and no host was notified. To test real booking requests, connect the database and use the live Explore Stays page.
            </p>
          ) : null}
        </div>
      ) : viewer === "anonymous" ? (
        <div className="mt-5 flex flex-col gap-4">
          {fields}
          <p className="text-sm text-ink/70">Choose your dates and guests, then sign in to send the host a booking request. Your choices are kept. It&apos;s a request — nothing is charged and nothing is confirmed until the host accepts.</p>
          <Link href={authHrefForBooking("sign-in", slug, selection)} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-forest-800 text-sm font-medium text-cream hover:bg-forest-700">
            Sign in to request
          </Link>
          <p className="text-center text-xs text-ink/55">
            New here? <Link href={authHrefForBooking("sign-up", slug, selection)} className="underline">Create an account</Link>
          </p>
        </div>
      ) : (
        <form action={action} className="mt-5 flex flex-col gap-4" noValidate>
          <input type="hidden" name="property_id" value={propertyId} />
          <FormMessage state={state} />
          {fields}
          <Field label="Message to the host (optional)" htmlFor="message" error={e.message}>
            <TextArea id="message" name="message" rows={3} maxLength={2000} placeholder="Occasion, arrival time, dietary needs…" defaultValue={state?.values?.message} />
          </Field>
          <SubmitButton pendingLabel="Sending request…" disabled={Boolean(problem)}>Request to book</SubmitButton>
          <p className="text-center text-xs text-ink/55">You won&apos;t be charged. The host reviews your request first.</p>
        </form>
      )}
    </div>
  );
}
