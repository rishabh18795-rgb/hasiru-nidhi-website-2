"use client";

import { useActionState } from "react";

import { adminCompleteBooking, createSettlement, recordPayment, recordRefund, setCommission, updateSettlement } from "@/app/admin/actions";
import type { FormState } from "@/lib/action";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};
const input = "h-9 rounded-lg border border-forest-900/15 bg-white px-3 text-sm";

function Feedback({ state }: { state: FormState }) {
  const first = state?.message ?? Object.values(state?.fieldErrors ?? {}).flat().find(Boolean);
  return first ? <span role={state?.ok ? "status" : "alert"} className={`text-xs ${state?.ok ? "text-forest-700" : "text-red-700"}`}>{first}</span> : null;
}

/** Records a payment that an administrator confirms was actually received. It does not charge anyone. */
export function RecordPaymentForm({ bookingId, suggested }: { bookingId: string; suggested?: number }) {
  const [state, action] = useActionState(recordPayment, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input name="amount" type="number" min="1" step="0.01" inputMode="decimal" required defaultValue={suggested ? String(suggested) : ""} aria-label="Amount received in rupees" placeholder="Amount ₹" className={`${input} w-32`} />
      <input name="reference" required minLength={2} maxLength={120} aria-label="Bank or UPI reference" placeholder="Bank / UPI reference" className={`${input} min-w-44 flex-1`} />
      <input name="note" maxLength={500} aria-label="Note" placeholder="Note (optional)" className={`${input} min-w-32 flex-1`} />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Record payment</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function RefundForm({ paymentId, max }: { paymentId: string; max: number }) {
  const [state, action] = useActionState(recordRefund, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="payment_id" value={paymentId} />
      <input name="amount" type="number" min="1" max={max} step="0.01" inputMode="decimal" required aria-label="Refund amount in rupees" placeholder={`Refund ₹ (max ${max})`} className={`${input} w-40`} />
      <input name="reason" required minLength={3} maxLength={300} aria-label="Refund reason" placeholder="Reason" className={`${input} min-w-44 flex-1`} />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Record refund</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function CommissionForm({ rate, basis, reverseOnCancellation, refundReverses, settlementRequiresPayment }: {
  rate: number; basis: string; reverseOnCancellation: boolean; refundReverses: boolean; settlementRequiresPayment: boolean;
}) {
  const [state, action] = useActionState(setCommission, initial);
  const check = "h-4 w-4 rounded border-forest-900/30";
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-forest-950">
          Platform commission (%)
          <input name="rate" type="number" min="0" max="50" step="0.01" required defaultValue={rate} className={`${input} max-w-40`} aria-describedby="rate-hint" />
          <span id="rate-hint" className="text-xs font-normal text-ink/55">Default 20. Allowed range 0–50. New bookings only.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-forest-950">
          Commission is charged on
          <select name="basis" defaultValue={basis} className={input}>
            <option value="accommodation">Accommodation (stay + extra-guest charges)</option>
            <option value="accommodation_and_cleaning">Accommodation + cleaning fee</option>
          </select>
          <span className="text-xs font-normal text-ink/55">Taxes are never commissionable. Confirm the treatment with your accountant.</span>
        </label>
      </div>
      <fieldset className="space-y-2 text-sm text-forest-950">
        <legend className="mb-1 font-medium">Policies</legend>
        <label className="flex items-center gap-2"><input type="checkbox" name="reverse_on_cancellation" defaultChecked={reverseOnCancellation} className={check} /> Reverse the commission when a confirmed booking is cancelled</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="refund_reverses" defaultChecked={refundReverses} className={check} /> Reverse commission in proportion to a recorded refund</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="settlement_requires_payment" defaultChecked={settlementRequiresPayment} className={check} /> Only settle host earnings once the booking&apos;s payment is recorded as received</label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save commission settings</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function CreateSettlementForm({ hostId }: { hostId: string }) {
  const [state, action] = useActionState(createSettlement, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="host_id" value={hostId} />
      <input name="note" maxLength={500} aria-label="Settlement note" placeholder="Note (optional)" className={`${input} min-w-44 flex-1`} />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Create settlement</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

const NEXT: Record<string, string[]> = { pending: ["processing", "on_hold"], on_hold: ["pending"], processing: ["paid", "failed"], failed: ["pending"], paid: [] };

export function SettlementStatusForm({ id, status, reference }: { id: string; status: string; reference: string | null }) {
  const [state, action] = useActionState(updateSettlement, initial);
  const options = NEXT[status] ?? [];
  if (options.length === 0) return <p className="text-xs text-ink/55">No further changes{reference ? ` · reference ${reference}` : ""}.</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="settlement_id" value={id} />
      <select name="status" aria-label="New status" defaultValue={options[0]} className={`${input} capitalize`}>
        {options.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
      </select>
      <input name="reference" maxLength={120} defaultValue={reference ?? ""} aria-label="Bank transfer reference" placeholder="Bank reference (required for paid)" className={`${input} min-w-52 flex-1`} />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Update</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function AdminCompleteForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(adminCompleteBooking, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Mark stay completed</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
