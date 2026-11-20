"use client";

import { useActionState } from "react";
import { MapPin } from "lucide-react";

import { placeOrder } from "@/app/cart/actions";
import type { FormState } from "@/lib/action";
import type { CustomerAddress } from "@/lib/db/types";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/lib/utils";

const initial: FormState = {};

/** Address choice, the unpaid-request acknowledgement and the submit button. The key makes a double submit harmless. */
export function CheckoutForm({ addresses, selectedId, idempotencyKey, blocked }: { addresses: CustomerAddress[]; selectedId: string; idempotencyKey: string; blocked: string | null }) {
  const [state, action] = useActionState(placeOrder, initial);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="key" value={idempotencyKey} />
      <FormMessage state={state} />
      <fieldset>
        <legend className="font-display text-xl text-forest-950">Deliver to</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest-500", a.id === selectedId ? "border-forest-700 bg-forest-50" : "border-forest-900/15 bg-white hover:bg-forest-50/50")}>
              <input type="radio" name="address_id" value={a.id} defaultChecked={a.id === selectedId} className="mt-1 h-4 w-4 accent-forest-700" onChange={(e) => { const u = new URL(window.location.href); u.searchParams.set("address", e.target.value); window.location.assign(u.toString()); }} />
              <span><span className="flex items-center gap-1.5 font-medium text-forest-950"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{a.label || a.full_name}{a.is_default ? <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[11px] text-forest-800">Default</span> : null}</span>
                <span className="mt-1 block text-ink/70">{a.full_name}, {a.phone}</span>
                <span className="block text-ink/70">{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}</span>
                <span className="block text-ink/70">{a.city}, {a.state} {a.postal_code}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <input type="checkbox" name="acknowledge" className="mt-0.5 h-4 w-4 shrink-0 accent-forest-700" />
        <span>I understand this is an <strong>unpaid order request</strong>. Payment is not configured, nothing will be charged, and each seller must accept their part of the order.</span>
      </label>
      {blocked ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{blocked}</p> : null}
      <SubmitButton pendingLabel="Sending your request…" disabled={Boolean(blocked)} className="h-12 w-full sm:w-auto sm:px-10">Submit order request</SubmitButton>
    </form>
  );
}
