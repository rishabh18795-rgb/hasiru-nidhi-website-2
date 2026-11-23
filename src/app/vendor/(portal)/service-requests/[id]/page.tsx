import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { ServicePaymentNotice } from "@/components/orders/payment-notice";
import { RequestTimeline } from "@/components/services/request-timeline";
import { ServicesGate } from "@/components/vendor/capability-gate";
import { ProviderCancelForm, QuotationForm, RespondRequestForm, ScheduleForm, StepButtons } from "@/components/vendor/service-request-forms";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { addDays, formatDate, formatDateTime, formatPrice, todayIST } from "@/lib/format";
import { PRICE_UNIT_TEXT, REQUEST_STATUS_LABEL } from "@/lib/services";
import type { ServiceAppointment, ServiceHistoryRow, ServiceQuotation, ServiceRequest } from "@/lib/db/types";

export const metadata: Metadata = { title: "Service request" };

export default async function VendorServiceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/vendor/service-requests/${id}`);
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "services")) return <ServicesGate ctx={ctx} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await supabase.from("service_requests").select("*").eq("id", id).eq("vendor_id", ctx.vendor!.id).maybeSingle();
  if (!r) notFound();
  const req = r as ServiceRequest;
  const [{ data: q }, { data: ap }, { data: hi }, { data: ct }] = await Promise.all([
    supabase.from("service_quotations").select("*").eq("request_id", id).order("version", { ascending: false }),
    supabase.from("service_appointments").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("service_request_history").select("id, from_status, to_status, actor_kind, note, created_at").eq("request_id", id).order("id"),
    supabase.from("service_request_contact").select("phone, address_line").eq("request_id", id).maybeSingle(),
  ]);
  const quotes = (q ?? []) as ServiceQuotation[];
  const appointment = ((ap ?? []) as ServiceAppointment[]).find((a) => a.status !== "cancelled") ?? null;
  const history = (hi ?? []) as ServiceHistoryRow[];
  const contact = ct as { phone: string; address_line: string } | null; // RLS returns it only once the request is accepted
  const fixed = req.pricing_model === "fixed";
  const validDefault = addDays(todayIST(), 7);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor/service-requests" className="text-sm text-forest-700 underline">← All requests</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{req.request_number}</h1><StatusBadge status={req.status} /></div>
        <p className="mt-1 text-sm text-ink/65">{req.service_name} · Received {formatDateTime(req.created_at)} · {REQUEST_STATUS_LABEL[req.status]}</p>
      </div>
      <Card><RequestTimeline status={req.status} pricing={req.pricing_model} /></Card>
      <ServicePaymentNotice />

      {req.status === "submitted" ? (
        <>
          {fixed ? <Card><CardTitle>Accept or decline</CardTitle><RespondRequestForm requestId={req.id} fixed /></Card> : (
            <>
              <Card><CardTitle>Send a quotation</CardTitle><p className="mb-4 text-sm text-ink/70">This service is quotation-based. Read the details below, then quote the job. The customer will accept or decline it.</p><QuotationForm requestId={req.id} defaultDuration={req.duration_minutes} defaultValidUntil={validDefault} revision={quotes.length > 0} /></Card>
              <Card><CardTitle>Or decline</CardTitle><RespondRequestForm requestId={req.id} fixed={false} /></Card>
            </>
          )}
        </>
      ) : null}
      {req.status === "quoted" ? (
        <Card>
          <CardTitle>Waiting for the customer</CardTitle>
          <p className="text-sm text-ink/70">Your quotation is with the customer. You can send a revised quotation (it replaces the old one) or decline.</p>
          <div className="mt-5 space-y-6"><QuotationForm requestId={req.id} defaultDuration={req.duration_minutes} defaultValidUntil={validDefault} revision /><RespondRequestForm requestId={req.id} fixed={false} /></div>
        </Card>
      ) : null}
      {req.status === "accepted" || req.status === "in_progress" ? (
        <>
          <Card><CardTitle>Appointment</CardTitle>
            {appointment ? <p className="mb-4 flex items-center gap-2 text-sm font-medium text-forest-950" data-testid="appointment"><CalendarClock className="h-4 w-4" aria-hidden="true" />{formatDateTime(appointment.starts_at)} (IST)</p> : <p className="mb-4 text-sm text-ink/70">No appointment is set yet. Choose a time that is free and inside your weekly hours.</p>}
            <ScheduleForm requestId={req.id} defaultDuration={req.duration_minutes} />
          </Card>
          <Card><CardTitle>Progress</CardTitle><StepButtons requestId={req.id} status={req.status} /></Card>
          <Card><CardTitle>Cancel</CardTitle><p className="mb-3 text-sm text-ink/70">Only if you cannot do the work. The customer and our team are told.</p><ProviderCancelForm requestId={req.id} /></Card>
        </>
      ) : null}

      <Card>
        <CardTitle>Customer and site</CardTitle>
        <DefinitionList items={[
          { label: "Customer", value: req.customer_name },
          { label: "Phone", value: contact?.phone ?? "Shown once you accept the request" },
          { label: "Address", value: contact ? [contact.address_line, req.site_city, req.site_pin].join(", ") : `${req.site_city}, ${req.site_pin} (full address once accepted)` },
          { label: "Type of place", value: req.property_type },
          { label: "Approximate size", value: req.site_size },
          { label: "Preferred time", value: req.preferred_start ? `${formatDateTime(req.preferred_start)} (IST)` : null },
          { label: "Pricing", value: fixed ? `${formatPrice(req.unit_price_inr)} ${PRICE_UNIT_TEXT[req.price_unit ?? ""] ?? ""} × ${req.quantity} = ${formatPrice(req.agreed_total_inr)}` : req.agreed_total_inr !== null ? `Agreed ${formatPrice(req.agreed_total_inr)}` : "Quotation on request" },
        ]} />
        {req.details ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{req.details}</p> : null}
      </Card>

      {quotes.length ? (
        <Card>
          <CardTitle>Quotations</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">
            {quotes.map((x) => <li key={x.id} className="py-3"><span className="font-medium text-forest-950">Version {x.version}: {formatPrice(x.amount_inr)}</span> <span className="capitalize text-ink/65">· {x.status}</span><span className="block text-xs text-ink/65">Valid until {formatDate(x.valid_until)}{x.proposed_start ? ` · proposed ${formatDateTime(x.proposed_start)}` : ""}</span><span className="mt-1 block whitespace-pre-line text-ink/75">{x.description}</span>{x.decision_note ? <span className="mt-1 block text-xs text-ink/65">Customer note: {x.decision_note}</span> : null}</li>)}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>History</CardTitle>
        <ol className="space-y-2 text-sm">
          {history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-medium text-forest-950">{REQUEST_STATUS_LABEL[h.to_status]}</span>{h.note ? <span className="text-ink/65"> · {h.note}</span> : null}</span><span className="text-xs text-ink/65">{formatDateTime(h.created_at)}</span></li>)}
        </ol>
      </Card>
    </div>
  );
}
