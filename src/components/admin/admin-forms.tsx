"use client";

import { useActionState } from "react";

import { addCatalogItem, adminCancelBooking, reviewListing, saveSettings, triageItem, updateUser } from "@/app/admin/actions";
import type { FormState } from "@/lib/action";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ReviewListingForm({ propertyId, status }: { propertyId: string; status: string }) {
  const [state, action] = useActionState(reviewListing, initial);
  const options: { value: string; label: string }[] =
    status === "pending_review" ? [{ value: "approve", label: "Approve & publish" }, { value: "reject", label: "Reject (reason required)" }]
    : status === "rejected" ? [{ value: "approve", label: "Approve & publish" }]
    : status === "approved" ? [{ value: "suspend", label: "Suspend (reason required)" }]
    : status === "suspended" ? [{ value: "reinstate", label: "Reinstate" }]
    : [];
  if (options.length === 0) return <p className="text-sm text-ink/60">Drafts can&apos;t be reviewed until the host submits them.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="property_id" value={propertyId} />
      <FormMessage state={state} />
      <Field label="Decision" htmlFor="decision">
        <NativeSelect id="decision" name="decision" defaultValue={options[0].value}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Reason / note to the host" htmlFor="reason" hint="Required for rejection and suspension. The host sees this.">
        <TextArea id="reason" name="reason" rows={3} maxLength={1000} />
      </Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Apply decision</SubmitButton>
    </form>
  );
}

export function UserActions({ userId, role, suspended, verified }: { userId: string; role: string; suspended: boolean; verified: boolean }) {
  const [state, action] = useActionState(updateUser, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select name="role" defaultValue={role} aria-label="Role" className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">
        <option value="traveller">Traveller</option>
        <option value="host">Host</option>
      </select>
      <select name="suspended" defaultValue={String(suspended)} aria-label="Suspension" className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">
        <option value="false">Active</option>
        <option value="true">Suspended</option>
      </select>
      <select name="verified" defaultValue={String(verified)} aria-label="Host verification" className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm">
        <option value="false">Not verified</option>
        <option value="true">Verified host</option>
      </select>
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Update</SubmitButton>
      {state?.message ? <span role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}

export function TriageForm({ table, id, status, notes, statuses }: { table: string; id: string; status: string; notes?: string | null; statuses: string[] }) {
  const [state, action] = useActionState(triageItem, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={status} aria-label="Status" className="h-9 rounded-lg border border-forest-900/15 bg-white px-2 text-sm capitalize">
          {statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        {table !== "reports" ? <input name="admin_notes" defaultValue={notes ?? ""} placeholder="Internal notes" aria-label="Internal notes" maxLength={3000} className="h-9 min-w-48 flex-1 rounded-lg border border-forest-900/15 bg-white px-3 text-sm" /> : null}
        <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Save</SubmitButton>
      </div>
      {state?.message ? <span role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</span> : null}
    </form>
  );
}

export function AddCatalogForm({ kind, label, withGroup }: { kind: string; label: string; withGroup?: boolean }) {
  const [state, action] = useActionState(addCatalogItem, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="kind" value={kind} />
      <Field label={`New ${label}`} htmlFor={`new-${kind}`} error={state?.fieldErrors?.name} className="min-w-52 flex-1"><TextInput id={`new-${kind}`} name="name" maxLength={80} /></Field>
      {withGroup ? <Field label="Group" htmlFor={`grp-${kind}`}><TextInput id={`grp-${kind}`} name="group_name" placeholder="e.g. comfort" maxLength={40} /></Field> : null}
      <SubmitButton variant="outline" pendingLabel="Adding…">Add</SubmitButton>
      <div className="basis-full"><FormMessage state={state} /></div>
    </form>
  );
}

export function SettingsForm({ values }: { values: Record<string, string> }) {
  const [state, action] = useActionState(saveSettings, initial);
  const v = (k: string) => state?.values?.[k] ?? values[k] ?? "";
  return (
    <form action={action} className="flex max-w-xl flex-col gap-5">
      <FormMessage state={state} />
      <Field label="WhatsApp business number" htmlFor="whatsapp_number" hint="Digits only with country code, e.g. 9198XXXXXXXX. Leave empty to hide all WhatsApp buttons.">
        <TextInput id="whatsapp_number" name="whatsapp_number" inputMode="numeric" defaultValue={v("whatsapp_number")} />
      </Field>
      <Field label="Support email" htmlFor="support_email"><TextInput id="support_email" name="support_email" type="email" defaultValue={v("support_email")} /></Field>
      <Field label="Support phone" htmlFor="support_phone"><TextInput id="support_phone" name="support_phone" type="tel" defaultValue={v("support_phone")} /></Field>
      <Field label="Announcement bar" htmlFor="announcement" hint="A genuine offer or notice shown above the header. Leave empty to hide the bar."><TextInput id="announcement" name="announcement" maxLength={200} defaultValue={v("announcement")} /></Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Save settings</SubmitButton>
    </form>
  );
}

export function AdminCancelForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(adminCancelBooking, initial);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <SubmitButton variant="danger" pendingLabel="Cancelling…" className="h-9 px-4">Cancel booking</SubmitButton>
      {state?.message ? <span role="alert" className="text-xs text-red-700">{state.message}</span> : null}
    </form>
  );
}
