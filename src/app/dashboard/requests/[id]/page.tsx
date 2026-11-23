import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { CancelRequestForm, QuotationDecisionForm } from "@/components/dashboard/service-request-forms";
import { ServicePaymentNotice } from "@/components/orders/payment-notice";
import { RequestTimeline } from "@/components/services/request-timeline";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatPrice, todayIST } from "@/lib/format";
import { PRICE_UNIT_TEXT, REQUEST_STATUS_LABEL } from "@/lib/services";
import type { ServiceAppointment, ServiceHistoryRow, ServiceQuotation, ServiceRequest } from "@/lib/db/types";

export const metadata: Metadata = { title: "Service request" };

export default async function ServiceRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireUser(`/dashboard/requests/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await supabase.from("service_requests").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!r) notFound();
  const req = r as ServiceRequest;
  const [{ data: q }, { data: ap }, { data: hi }, { data: ct }, { data: sv }] = await Promise.all([
    supabase.from("service_quotations").select("*").eq("request_id", id).order("version", { ascending: false }),
    supabase.from("service_appointments").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("service_request_history").select("id, from_status, to_status, actor_kind, note, created_at").eq("request_id", id).order("id"),
    supabase.from("service_request_contact").select("phone, address_line").eq("request_id", id).maybeSingle(),
    supabase.from("services").select("slug").eq("id", req.service_id).maybeSingle(),
  ]);
  const quotes = (q ?? []) as ServiceQuotation[];
  const appointments = (ap ?? []) as ServiceAppointment[];
  const appointment = appointments.find((a) => a.status !== "cancelled") ?? null;
  const history = (hi ?? []) as ServiceHistoryRow[];
  const contact = ct as { phone: string; address_line: string } | null;
  const live = quotes.find((x) => x.status === "sent") ?? null;
  const expired = live ? live.valid_until < todayIST() : false;
  const canCancel = ["submitted", "quoted", "accepted"].includes(req.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/requests" className="text-sm text-forest-700 underline">← All service requests</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{req.request_number}</h1><StatusBadge status={req.status} /></div>
        <p className="mt-1 text-sm text-ink/60">{sv?.slug ? <Link href={`/services/${sv.slug}`} className="underline">{req.service_name}</Link> : req.service_name} · {req.vendor_name} · Sent {formatDateTime(req.created_at)}</p>
      </div>
      {sp.sent ? <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Your request was sent to {req.vendor_name}. You will be notified when they respond.</p> : null}

      <Card><RequestTimeline status={req.status} pricing={req.pricing_model} /><p className="mt-4 text-sm text-ink/70">{REQUEST_STATUS_LABEL[req.status]}{req.decline_reason ? `: ${req.decline_reason}` : ""}{req.status === "cancelled" && req.cancel_reason ? `: ${req.cancel_reason}` : ""}</p></Card>
      <ServicePaymentNotice />

      {live ? (
        <Card id="quotation">
          <CardTitle aside={<span className="text-xs text-ink/55">Version {live.version}</span>}>Quotation</CardTitle>
          <p className="font-display text-3xl text-forest-950" data-testid="quotation-amount">{formatPrice(live.amount_inr)}</p>
          <p className="mt-1 text-xs text-ink/60">{expired ? <span className="font-medium text-red-700">Expired on {formatDate(live.valid_until)}. Ask the provider for a new one.</span> : <>Valid until {formatDate(live.valid_until)}</>} · Taxes are not configured yet.</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">{live.description}</p>
          {live.proposed_start ? <p className="mt-3 flex items-center gap-2 text-sm text-ink/80"><CalendarClock className="h-4 w-4" aria-hidden="true" /> Proposed time: {formatDateTime(live.proposed_start)} (IST). It is booked for you when you accept.</p> : null}
          {!expired ? <div className="mt-5 border-t border-forest-900/10 pt-5"><QuotationDecisionForm quotationId={live.id} requestId={req.id} /></div> : null}
        </Card>
      ) : null}

      {appointment ? (
        <Card>
          <CardTitle>Appointment</CardTitle>
          <p className="flex items-center gap-2 text-sm font-medium text-forest-950" data-testid="appointment"><CalendarClock className="h-4 w-4" aria-hidden="true" />{formatDateTime(appointment.starts_at)} (IST), about {Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000)} minutes</p>
          <p className="mt-2 text-xs text-ink/55">Set by the provider within their published hours. If it no longer suits you, cancel the request or message the provider.</p>
        </Card>
      ) : ["accepted"].includes(req.status) ? <Card><CardTitle>Appointment</CardTitle><p className="text-sm text-ink/70">The provider has not set a time yet. You will be notified when they do.</p></Card> : null}

      <Card>
        <CardTitle>Your request</CardTitle>
        <DefinitionList items={[
          { label: "Service", value: req.service_name },
          { label: "Provider", value: req.vendor_name },
          { label: "Pricing", value: req.pricing_model === "fixed" ? `${formatPrice(req.unit_price_inr)} ${PRICE_UNIT_TEXT[req.price_unit ?? ""] ?? ""} × ${req.quantity} = ${formatPrice(req.agreed_total_inr)}` : req.agreed_total_inr !== null ? `Quoted ${formatPrice(req.agreed_total_inr)}` : "Quotation on request" },
          { label: "Where", value: [contact?.address_line, req.site_city, req.site_pin].filter(Boolean).join(", ") },
          { label: "Phone", value: contact?.phone },
          { label: "Type of place", value: req.property_type },
          { label: "Approximate size", value: req.site_size },
          { label: "Preferred time", value: req.preferred_start ? `${formatDateTime(req.preferred_start)} (IST)` : null },
        ]} />
        {req.details ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{req.details}</p> : null}
      </Card>

      {quotes.length > 1 || (quotes.length === 1 && !live) ? (
        <Card>
          <CardTitle>Earlier quotations</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">
            {quotes.filter((x) => x.id !== live?.id).map((x) => <li key={x.id} className="py-2.5"><span className="font-medium text-forest-950">Version {x.version}: {formatPrice(x.amount_inr)}</span> <span className="capitalize text-ink/60">· {x.status}</span>{x.decision_note ? <span className="block text-xs text-ink/60">Your note: {x.decision_note}</span> : null}</li>)}
          </ul>
        </Card>
      ) : null}

      {canCancel ? <Card><CardTitle>Cancel</CardTitle><CancelRequestForm requestId={req.id} accepted={req.status === "accepted"} /></Card> : null}

      <Card>
        <CardTitle>History</CardTitle>
        <ol className="space-y-2 text-sm">
          {history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-medium text-forest-950">{REQUEST_STATUS_LABEL[h.to_status]}</span>{h.note ? <span className="text-ink/60"> · {h.note}</span> : null}</span><span className="text-xs text-ink/50">{formatDateTime(h.created_at)}</span></li>)}
        </ol>
      </Card>
    </div>
  );
}
