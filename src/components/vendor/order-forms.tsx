"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideRequest, markPacked, respondOrder, shipOrder, updateShipment } from "@/app/vendor/order-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function RespondOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(respondOrder, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      <Field label="Decision" htmlFor="respond-decision"><NativeSelect id="respond-decision" name="decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? "accept"}><option value="accept">Accept this order request</option><option value="reject">Decline (reason required)</option></NativeSelect></Field>
      <Field label="Note or reason" htmlFor="respond-reason" hint="Required to decline. The customer sees it."><TextArea id="respond-reason" name="reason" rows={3} maxLength={500} defaultValue={state.values?.reason} /></Field>
      <SubmitButton pendingLabel="Saving…">Apply decision</SubmitButton>
      <p className="text-xs text-ink/55">Accepting does not mean payment has been received: this order is unpaid and payment is not configured. Agree payment arrangements with the customer yourself.</p>
    </form>
  );
}

export function PackedButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await markPacked(orderId); setMsg({ ok: Boolean(r.ok), text: r.message ?? "" }); if (r.ok) router.refresh(); })} className="inline-flex h-10 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700 disabled:opacity-60">{pending ? "Saving…" : "Mark as packed"}</button>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-forest-800" : "text-red-700"}`}>{msg.text}</p> : null}
    </div>
  );
}

export function ShipForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(shipOrder, initial);
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Carrier or courier" htmlFor="ship-carrier" required error={err("carrier")}><TextInput id="ship-carrier" name="carrier" maxLength={80} defaultValue={state.values?.carrier} error={Boolean(err("carrier"))} /></Field>
      <Field label="Tracking number" htmlFor="ship-tracking" required error={err("tracking")}><TextInput id="ship-tracking" name="tracking" maxLength={80} defaultValue={state.values?.tracking} error={Boolean(err("tracking"))} /></Field>
      <Field label="Tracking link (optional)" htmlFor="ship-url" error={err("url")} className="sm:col-span-2"><TextInput id="ship-url" name="url" type="url" maxLength={500} placeholder="https://" defaultValue={state.values?.url} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Mark as shipped</SubmitButton></div>
    </form>
  );
}

export function ShipmentUpdateForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(updateShipment, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      <label className="text-xs text-ink/70">Update shipment
        <NativeSelect name="status" key={String(state.values?.status ?? "")} defaultValue={state.values?.status ?? "in_transit"} className="mt-1 h-10 text-sm"><option value="in_transit">In transit</option><option value="out_for_delivery">Out for delivery</option><option value="delivered">Delivered</option><option value="failed">Delivery failed</option></NativeSelect>
      </label>
      <label className="min-w-40 flex-1 text-xs text-ink/70">Note (optional)<TextInput name="note" maxLength={300} defaultValue={state.values?.note} className="mt-1 h-10 text-sm" /></label>
      <SubmitButton variant="outline" pendingLabel="…" className="h-10 px-5">Update</SubmitButton>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={`w-full text-sm ${state.ok ? "text-forest-800" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}

export function RequestDecisionForm({ requestId, orderId, kind, status }: { requestId: string; orderId: string; kind: string; status: string }) {
  const [state, action] = useActionState(decideRequest, initial);
  const options = status === "requested" ? [["approve", kind === "cancel" ? "Approve (cancels the order and returns stock)" : "Approve"], ["reject", "Reject (note required)"]] : status === "approved" && kind !== "cancel" ? [["complete", "Mark as completed"]] : [];
  if (!options.length) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="order_id" value={orderId} />
      <select name="decision" aria-label="Decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? options[0][0]} className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input name="note" aria-label="Note to the customer" placeholder="Note" maxLength={1000} defaultValue={state.values?.note} className="h-9 min-w-40 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" />
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Apply</SubmitButton>
      {state.message ? <span role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}
