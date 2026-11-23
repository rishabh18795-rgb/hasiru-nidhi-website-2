"use client";

import { useActionState, useState } from "react";

import { saveService } from "@/app/vendor/service-actions";
import type { FormState } from "@/lib/action";
import type { Service, ServiceCategory } from "@/lib/db/types";
import { attributesToText } from "@/lib/validation/product";
import { PRICE_UNITS } from "@/lib/services";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ServiceForm({ service, categories, locked }: { service: Service | null; categories: ServiceCategory[]; locked?: boolean }) {
  const [state, action] = useActionState(saveService, initial);
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const err = (k: string) => state.fieldErrors?.[k];
  const [model, setModel] = useState<string>(service?.pricing_model ?? "quote");
  const pricing = state.values?.pricing_model ?? model;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2 disabled:opacity-70">
        <Field label="Service name" htmlFor="svc-name" required error={err("name")} className="sm:col-span-2">
          <TextInput id="svc-name" name="name" defaultValue={v("name", service?.name ?? "")} maxLength={120} error={Boolean(err("name"))} />
        </Field>
        <Field label="Category" htmlFor="svc-category" required error={err("category_id")}>
          <NativeSelect id="svc-category" name="category_id" defaultValue={v("category_id", String(service?.category_id ?? ""))} error={Boolean(err("category_id"))}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Length of one visit (minutes)" htmlFor="svc-duration" required error={err("duration_minutes")} hint="Between 15 and 480. Customers pick start times in blocks of this length.">
          <TextInput id="svc-duration" name="duration_minutes" type="number" min={15} max={480} step={15} defaultValue={v("duration_minutes", String(service?.duration_minutes ?? 60))} error={Boolean(err("duration_minutes"))} />
        </Field>
        <Field label="How is it priced?" htmlFor="svc-pricing" required error={err("pricing_model")} className="sm:col-span-2" hint="Fixed price: customers see your price and send a booking request. Quotation: you price each job after seeing the details. No deposits are taken.">
          <NativeSelect id="svc-pricing" name="pricing_model" value={pricing} onChange={(e) => setModel(e.target.value)} error={Boolean(err("pricing_model"))}>
            <option value="quote">Quotation on request (I price each job)</option>
            <option value="fixed">Fixed price</option>
          </NativeSelect>
        </Field>
        {pricing === "fixed" ? (
          <>
            <Field label="Price (₹)" htmlFor="svc-price" required error={err("price_inr")}><TextInput id="svc-price" name="price_inr" inputMode="decimal" defaultValue={v("price_inr", service?.price_inr != null ? String(service.price_inr) : "")} error={Boolean(err("price_inr"))} /></Field>
            <Field label="Price is" htmlFor="svc-unit" required error={err("price_unit")}>
              <NativeSelect id="svc-unit" name="price_unit" defaultValue={v("price_unit", service?.price_unit ?? "visit")} error={Boolean(err("price_unit"))}>{PRICE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</NativeSelect>
            </Field>
          </>
        ) : null}
        <Field label="Short summary" htmlFor="svc-summary" hint="One or two sentences shown on cards (up to 240 characters)." error={err("summary")} className="sm:col-span-2">
          <TextInput id="svc-summary" name="summary" defaultValue={v("summary", service?.summary ?? "")} maxLength={240} />
        </Field>
        <Field label="Description" htmlFor="svc-description" hint="What you do, how you work, what customers should prepare. At least 30 characters to submit. Only claim what is true." error={err("description")} className="sm:col-span-2">
          <TextArea id="svc-description" name="description" rows={6} defaultValue={v("description", service?.description ?? "")} maxLength={8000} />
        </Field>
        <Field label="What is included" htmlFor="svc-specs" hint={'One per line, as "Label: value". For example "Tools: provided" or "Waste removal: included". Up to 20.'} error={err("specifications")} className="sm:col-span-2">
          <TextArea id="svc-specs" name="specifications" rows={4} defaultValue={v("specifications", attributesToText(service?.attributes))} placeholder={"Tools: provided\nGreen waste: taken away"} />
        </Field>
      </fieldset>
      {!locked ? <SubmitButton pendingLabel="Saving…" className="self-start">{service ? "Save details" : "Create draft"}</SubmitButton> : null}
      {service?.status === "approved" ? <p className="text-xs text-ink/60">This service is approved. Saving changes to its details or price sends it back for review and hides it until it is approved again.</p> : null}
    </form>
  );
}
