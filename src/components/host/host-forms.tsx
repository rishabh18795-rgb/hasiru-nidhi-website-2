"use client";

import { useActionState } from "react";

import { addRoomType, blockDates, cancelAsHost, deleteDraft, respondToBooking, submitForReview } from "@/app/host/actions";
import type { FormState } from "@/lib/action";
import { Field, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function SubmitForReviewForm({ propertyId, label = "Submit for review" }: { propertyId: string; label?: string }) {
  const [state, action] = useActionState(submitForReview, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="property_id" value={propertyId} />
      <FormMessage state={state} />
      {!state?.ok ? <SubmitButton pendingLabel="Submitting…" className="self-start">{label}</SubmitButton> : null}
    </form>
  );
}

export function DeleteDraftForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState(deleteDraft, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="property_id" value={propertyId} />
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingLabel="Deleting…" className="self-start">Delete this draft</SubmitButton>
    </form>
  );
}

export function AddRoomTypeForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState(addRoomType, initial);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-4" noValidate>
      <input type="hidden" name="property_id" value={propertyId} />
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
      <Field label="Room name" htmlFor="room-name" error={e.name} className="sm:col-span-2"><TextInput id="room-name" name="name" placeholder="e.g. Garden-view double" maxLength={80} /></Field>
      <Field label="Sleeps" htmlFor="room-cap" error={e.capacity}><TextInput id="room-cap" name="capacity" type="number" min={1} max={50} defaultValue="2" /></Field>
      <Field label="How many" htmlFor="room-qty" error={e.quantity}><TextInput id="room-qty" name="quantity" type="number" min={1} max={200} defaultValue="1" /></Field>
      <Field label="Price (₹, optional)" htmlFor="room-price" error={e.price_inr}><TextInput id="room-price" name="price_inr" type="number" min={0} /></Field>
      <Field label="Notes (optional)" htmlFor="room-desc" className="sm:col-span-2"><TextInput id="room-desc" name="description" maxLength={500} /></Field>
      <div className="sm:col-span-1 sm:self-end"><SubmitButton variant="outline" pendingLabel="Adding…">Add room</SubmitButton></div>
    </form>
  );
}

export function BlockDatesForm({ propertyId, minDate }: { propertyId: string; minDate: string }) {
  const [state, action] = useActionState(blockDates, initial);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-4" noValidate>
      <input type="hidden" name="property_id" value={propertyId} />
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
      <Field label="From" htmlFor="blk-from" error={e.start_date} required><TextInput id="blk-from" name="start_date" type="date" min={minDate} /></Field>
      <Field label="Until (check-out day)" htmlFor="blk-to" error={e.end_date} required><TextInput id="blk-to" name="end_date" type="date" min={minDate} /></Field>
      <Field label="Reason (private)" htmlFor="blk-reason" className="sm:col-span-1"><TextInput id="blk-reason" name="reason" maxLength={200} placeholder="e.g. Maintenance" /></Field>
      <div className="sm:self-end"><SubmitButton pendingLabel="Blocking…">Block dates</SubmitButton></div>
    </form>
  );
}

export function RespondToBookingForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(respondToBooking, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <FormMessage state={state} />
      <TextArea name="note" aria-label="Note to the guest (optional)" placeholder="Note to the guest (optional)" rows={2} maxLength={1000} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="decision" value="accept" className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Accept &amp; confirm</button>
        <button type="submit" name="decision" value="decline" className="inline-flex h-10 items-center rounded-full border border-red-300 bg-white px-5 text-sm font-medium text-red-700 hover:bg-red-50">Decline</button>
      </div>
    </form>
  );
}

export function HostCancelForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(cancelAsHost, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <details className="rounded-xl border border-forest-900/10 bg-stone-50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-red-700">Cancel this confirmed booking</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        <p className="text-xs text-ink/65">The guest will be notified immediately. Cancelling a confirmed stay may entitle the guest to a refund under your cancellation policy.</p>
        <FormMessage state={state} />
        <TextArea name="note" aria-label="Reason" placeholder="Reason for the guest" rows={2} maxLength={1000} />
        <SubmitButton variant="danger" pendingLabel="Cancelling…" className="self-start">Confirm cancellation</SubmitButton>
      </form>
    </details>
  );
}
