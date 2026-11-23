"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info, MapPin, XCircle } from "lucide-react";

import { checkCoverage, submitServiceRequest, type CoverageResult } from "@/app/services/actions";
import type { FormState } from "@/lib/action";
import { Field, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatPrice } from "@/lib/format";
import { PRICE_UNIT_TEXT, SERVICE_PAYMENT_EXPLAINER, UNIT_NOUN, newServiceKey } from "@/lib/services";
import type { ServicePricingModel, ServiceSlot } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const initial: FormState = {};

/**
 * The customer's request: a fixed-price booking request or a request for a quotation. Nothing is charged: the form says so.
 * PIN coverage is checked against the provider's own listed areas; offered times come only from the provider's published hours.
 */
export function ServiceRequestForm({ serviceId, serviceName, pricing, price, unit, slots, signedIn, signInHref, defaultName }: {
  serviceId: string; serviceName: string; pricing: ServicePricingModel; price: number | string | null; unit: string | null; slots: ServiceSlot[]; signedIn: boolean; signInHref: string; defaultName: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(submitServiceRequest, initial);
  const [key] = useState(newServiceKey);
  const [qty, setQty] = useState(1);
  const [pin, setPin] = useState("");
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [checking, startCheck] = useTransition();
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;
  const err = (k: string) => state.fieldErrors?.[k];
  const fixed = pricing === "fixed";
  const total = useMemo(() => (fixed && price !== null ? Number(price) * qty : null), [fixed, price, qty]);
  const requestId = state.ok && state.message?.startsWith("REQUEST:") ? state.message.slice(8) : null;

  useEffect(() => { if (requestId) router.push(`/dashboard/requests/${requestId}?sent=1`); }, [requestId, router]);

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-forest-900/10 bg-white p-6">
        <h2 className="font-display text-xl text-forest-950">{fixed ? "Request this service" : "Ask for a quotation"}</h2>
        <p className="mt-2 text-sm text-ink/70">Sign in or create a free account to send a request to the provider. You will be able to follow it, review any quotation and cancel it from your account.</p>
        <Link href={signInHref} className="mt-4 inline-flex h-11 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">Sign in to continue</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-forest-900/10 bg-white p-6" noValidate data-testid="request-form">
      <h2 className="font-display text-xl text-forest-950">{fixed ? "Request this service" : "Ask for a quotation"}</h2>
      <FormMessage state={requestId ? { ok: true, message: "Request sent. Taking you to it…" } : state} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="key" value={key} />
      <p className="sr-only">Request for {serviceName}</p>

      {fixed ? (
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-end">
          <Field label={`How many ${UNIT_NOUN[unit ?? "visit"] ?? "units"}?`} htmlFor="rq-qty" error={err("quantity")}>
            <TextInput id="rq-qty" name="quantity" type="number" min={1} max={1000} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
          </Field>
          <p className="text-sm text-ink/70" aria-live="polite">{price !== null ? <>{formatPrice(price)} {PRICE_UNIT_TEXT[unit ?? ""] ?? ""} × {qty} = <strong className="text-forest-950" data-testid="request-total">{formatPrice(total)}</strong></> : null}<span className="block text-xs text-ink/65">Taxes are not configured yet. The provider confirms the final amount.</span></p>
        </div>
      ) : <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-ink/75"><Info className="mr-2 inline h-4 w-4 text-earth-700" aria-hidden="true" />This provider prices each job after hearing the details. They will send you a quotation to accept or decline. You pay nothing to ask.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="rq-name" required error={err("customer_name")}><TextInput id="rq-name" name="customer_name" autoComplete="name" defaultValue={v("customer_name", defaultName)} maxLength={120} error={Boolean(err("customer_name"))} /></Field>
        <Field label="Phone" htmlFor="rq-phone" required error={err("phone")} hint="Shared with the provider only after the request is accepted."><TextInput id="rq-phone" name="phone" type="tel" autoComplete="tel" defaultValue={v("phone")} maxLength={20} error={Boolean(err("phone"))} /></Field>
        <Field label="Where is the work needed?" htmlFor="rq-address" required error={err("address_line")} className="sm:col-span-2" hint="House, building and street. The provider sees the street address only after accepting."><TextInput id="rq-address" name="address_line" autoComplete="street-address" defaultValue={v("address_line")} maxLength={300} error={Boolean(err("address_line"))} /></Field>
        <Field label="City or town" htmlFor="rq-city" required error={err("city")}><TextInput id="rq-city" name="city" autoComplete="address-level2" defaultValue={v("city")} maxLength={120} error={Boolean(err("city"))} /></Field>
        <Field label="PIN code" htmlFor="rq-pin" required error={err("pin")}>
          <div className="flex gap-2">
            <TextInput id="rq-pin" name="pin" inputMode="numeric" maxLength={6} value={pin || v("pin")} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setCoverage(null); }} error={Boolean(err("pin"))} className="w-36" />
            <button type="button" disabled={checking} onClick={() => startCheck(async () => setCoverage(await checkCoverage(serviceId, pin || v("pin"))))} className="inline-flex h-11 items-center rounded-full border border-forest-900/20 px-4 text-sm font-medium text-forest-900 hover:bg-forest-50 disabled:opacity-60">{checking ? "Checking…" : "Check area"}</button>
          </div>
        </Field>
        {coverage ? (
          <p role="status" data-testid="coverage-result" className={cn("flex items-start gap-2 text-sm sm:col-span-2", coverage.status === "yes" ? "text-forest-800" : coverage.status === "no" || !coverage.ok ? "text-red-700" : "text-ink/70")}>
            {coverage.status === "yes" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : coverage.status === "no" || !coverage.ok ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}{coverage.message}
          </p>
        ) : null}
        <Field label="Type of place (optional)" htmlFor="rq-type" error={err("property_type")}><TextInput id="rq-type" name="property_type" placeholder="e.g. Villa garden, balcony, farm" defaultValue={v("property_type")} maxLength={80} /></Field>
        <Field label="Approximate size (optional)" htmlFor="rq-size" error={err("site_size")}><TextInput id="rq-size" name="site_size" placeholder="e.g. 400 sq ft" defaultValue={v("site_size")} maxLength={80} /></Field>
        <Field label={fixed ? "Anything the provider should know (optional)" : "Describe the work you need"} htmlFor="rq-details" required={!fixed} error={err("details")} className="sm:col-span-2" hint={fixed ? undefined : "At least 10 characters. The more detail, the better the quotation."}>
          <TextArea id="rq-details" name="details" rows={4} maxLength={4000} defaultValue={v("details")} />
        </Field>
        <Field label={slots.length ? "Preferred time" : "Preferred date and time (optional, India time)"} htmlFor="rq-preferred" error={err("preferred")} className="sm:col-span-2" hint={slots.length ? "Only times the provider has published and not yet booked are shown." : "The provider confirms the actual time with you."}>
          {slots.length ? (
            <select id="rq-preferred" name="preferred" defaultValue={v("preferred")} className="h-11 w-full rounded-xl border border-forest-900/15 bg-white px-3 text-sm">
              <option value="">No preference: the provider will suggest a time</option>
              {slots.map((s) => <option key={s.slot_start} value={s.slot_start}>{s.slot_label}</option>)}
            </select>
          ) : <TextInput id="rq-preferred" name="preferred" type="datetime-local" defaultValue={v("preferred")} />}
        </Field>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><strong>Unpaid: payment is not configured.</strong> {SERVICE_PAYMENT_EXPLAINER}</span></p>
      <SubmitButton pendingLabel="Sending…">{fixed ? "Send request" : "Request a quotation"}</SubmitButton>
    </form>
  );
}
