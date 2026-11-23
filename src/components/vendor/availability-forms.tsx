"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addTimeOff, deleteTimeOff, saveAvailability } from "@/app/vendor/service-actions";
import type { FormState } from "@/lib/action";
import type { AvailabilityRule, TimeOff } from "@/lib/db/types";
import { WEEKDAYS } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Field, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};
const hhmm = (t: string | undefined) => (t ? t.slice(0, 5) : "");

/** One start and end per weekday (India time). A day left blank is not offered. An empty week means "I confirm times myself". */
export function WeeklyHoursForm({ rules }: { rules: AvailabilityRule[] }) {
  const [state, action] = useActionState(saveAvailability, initial);
  const by = new Map(rules.map((r) => [r.weekday, r]));
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="divide-y divide-forest-900/10 rounded-2xl border border-forest-900/10 bg-white">
        {WEEKDAYS.map((name, d) => (
          <div key={name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[9rem_10rem_10rem]">
            <span className="text-sm font-medium text-forest-950">{name}</span>
            <TextInput name={`start_${d}`} type="time" aria-label={`${name} start`} defaultValue={state.values?.[`start_${d}`] ?? hhmm(by.get(d)?.start_time)} className="h-10" />
            <TextInput name={`end_${d}`} type="time" aria-label={`${name} end`} defaultValue={state.values?.[`end_${d}`] ?? hhmm(by.get(d)?.end_time)} className="h-10" />
          </div>
        ))}
      </div>
      <p className="text-xs text-ink/65">Times are India time. Leave a day blank if you do not work that day. If you leave every day blank, customers can only state a preference and you confirm the time yourself.</p>
      <SubmitButton pendingLabel="Saving…">Save weekly hours</SubmitButton>
    </form>
  );
}

export function TimeOffForm() {
  const [state, action] = useActionState(addTimeOff, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end" noValidate>
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
      <Field label="From" htmlFor="to-start" required error={state.fieldErrors?.starts_on}><TextInput id="to-start" name="starts_on" type="date" defaultValue={state.values?.starts_on} /></Field>
      <Field label="To (inclusive)" htmlFor="to-end" required error={state.fieldErrors?.ends_on}><TextInput id="to-end" name="ends_on" type="date" defaultValue={state.values?.ends_on} /></Field>
      <Field label="Note (optional)" htmlFor="to-note"><TextInput id="to-note" name="note" maxLength={200} defaultValue={state.values?.note} /></Field>
      <SubmitButton pendingLabel="Adding…" className="h-11">Add days off</SubmitButton>
    </form>
  );
}

export function TimeOffList({ items }: { items: TimeOff[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (items.length === 0) return <p className="text-sm text-ink/65">No days off are set.</p>;
  return (
    <div className="space-y-2">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-forest-900/10 text-sm">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <span><span className="font-medium text-forest-950">{t.starts_on === t.ends_on ? formatDate(t.starts_on) : `${formatDate(t.starts_on)} to ${formatDate(t.ends_on)}`}</span>{t.note ? <span className="text-ink/65"> · {t.note}</span> : null}</span>
            <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteTimeOff(t.id); if (!r.ok) setError(r.message ?? "Could not remove it."); else { setError(null); router.refresh(); } })} className="text-red-700 underline disabled:opacity-60">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
