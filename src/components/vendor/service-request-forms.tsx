"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cancelByProvider, completeService, respondServiceRequest, scheduleAppointment, sendQuotation, startService } from "@/app/vendor/service-request-actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function RespondRequestForm({ requestId, fixed }: { requestId: string; fixed: boolean }) {
  const [state, action] = useActionState(respondServiceRequest, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      <Field label="Decision" htmlFor="svc-respond-decision">
        <NativeSelect id="svc-respond-decision" name="decision" key={String(state.values?.decision ?? "")} defaultValue={state.values?.decision ?? (fixed ? "accept" : "decline")}>
          {fixed ? <option value="accept">Accept this request</option> : null}
          <option value="decline">Decline (reason required)</option>
        </NativeSelect>
      </Field>
      <Field label="Note or reason" htmlFor="svc-respond-reason" hint="Required to decline. The customer sees it."><TextArea id="svc-respond-reason" name="reason" rows={3} maxLength={1000} defaultValue={state.values?.reason} /></Field>
      <SubmitButton pendingLabel="Saving…">Apply decision</SubmitButton>
      {fixed ? <p className="text-xs text-ink/55">Accepting does not mean payment has been received: this request is unpaid and payment is not configured. Agree payment arrangements with the customer yourself.</p> : null}
    </form>
  );
}

export function QuotationForm({ requestId, defaultDuration, defaultValidUntil, revision }: { requestId: string; defaultDuration: number; defaultValidUntil: string; revision: boolean }) {
  const [state, action] = useActionState(sendQuotation, initial);
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <input type="hidden" name="request_id" value={requestId} />
      <Field label="Quoted amount (₹)" htmlFor="q-amount" required error={err("amount_inr")} hint="The total for this job. No taxes or deposits are added by the platform."><TextInput id="q-amount" name="amount_inr" inputMode="decimal" defaultValue={state.values?.amount_inr} error={Boolean(err("amount_inr"))} /></Field>
      <Field label="Valid until" htmlFor="q-valid" required error={err("valid_until")} hint="Up to 180 days."><TextInput id="q-valid" name="valid_until" type="date" defaultValue={state.values?.valid_until ?? defaultValidUntil} error={Boolean(err("valid_until"))} /></Field>
      <Field label="What the quotation covers" htmlFor="q-desc" required error={err("description")} className="sm:col-span-2" hint="Work included, materials, number of visits, anything excluded."><TextArea id="q-desc" name="description" rows={4} maxLength={4000} defaultValue={state.values?.description} /></Field>
      <Field label="Proposed start (optional, India time)" htmlFor="q-start" error={err("proposed_start")} hint="If set, the time is booked for the customer as soon as they accept."><TextInput id="q-start" name="proposed_start" type="datetime-local" defaultValue={state.values?.proposed_start} /></Field>
      <Field label="Proposed length (minutes)" htmlFor="q-dur" error={err("proposed_duration_minutes")} hint={`Default ${defaultDuration} minutes.`}><TextInput id="q-dur" name="proposed_duration_minutes" type="number" min={15} max={720} defaultValue={state.values?.proposed_duration_minutes} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Sending…">{revision ? "Send a revised quotation" : "Send quotation"}</SubmitButton></div>
    </form>
  );
}

export function ScheduleForm({ requestId, defaultDuration }: { requestId: string; defaultDuration: number }) {
  const [state, action] = useActionState(scheduleAppointment, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <input type="hidden" name="request_id" value={requestId} />
      <Field label="Date and time (India time)" htmlFor="sch-start" required error={state.fieldErrors?.start} hint="Must be free, inside your weekly hours and not on a day off."><TextInput id="sch-start" name="start" type="datetime-local" defaultValue={state.values?.start} /></Field>
      <Field label="Length (minutes)" htmlFor="sch-dur" hint={`Default ${defaultDuration} minutes.`}><TextInput id="sch-dur" name="duration" type="number" min={15} max={720} defaultValue={state.values?.duration} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Scheduling…">Set appointment</SubmitButton></div>
    </form>
  );
}

export function StepButtons({ requestId, status }: { requestId: string; status: "accepted" | "in_progress" }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FormState>) => start(async () => { const r = await fn(); setMsg({ ok: Boolean(r.ok), text: r.message ?? "" }); if (r.ok) router.refresh(); });
  const btn = "inline-flex h-10 items-center rounded-full px-6 text-sm font-medium disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {status === "accepted" ? <button type="button" disabled={pending} onClick={() => run(() => startService(requestId))} className={`${btn} border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50`}>Mark as started</button> : null}
        <button type="button" disabled={pending} onClick={() => { if (window.confirm("Mark this service as completed?")) run(() => completeService(requestId)); }} className={`${btn} bg-forest-800 text-cream hover:bg-forest-700`}>{pending ? "Saving…" : "Mark as completed"}</button>
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-forest-800" : "text-red-700"}`}>{msg.text}</p> : null}
    </div>
  );
}

export function ProviderCancelForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(cancelByProvider, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      <Field label="Why are you cancelling?" htmlFor="pc-reason" required hint="The customer and our team see this."><TextArea id="pc-reason" name="reason" rows={2} maxLength={1000} defaultValue={state.values?.reason} /></Field>
      <SubmitButton variant="danger" pendingLabel="Cancelling…" className="h-10">Cancel this request</SubmitButton>
    </form>
  );
}
