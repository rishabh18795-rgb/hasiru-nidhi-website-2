import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { AdminCancelRequestForm } from "@/components/admin/service-forms";
import { ServicePaymentNotice } from "@/components/orders/payment-notice";
import { RequestTimeline } from "@/components/services/request-timeline";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { PRICE_UNIT_TEXT, REQUEST_STATUS_LABEL } from "@/lib/services";
import type { ServiceAppointment, ServiceHistoryRow, ServiceQuotation, ServiceRequest } from "@/lib/db/types";

export const metadata: Metadata = { title: "Service request" };

export default async function AdminServiceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole(["admin"], `/admin/service-requests/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: r } = await supabase.from("service_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const req = r as ServiceRequest;
  const [{ data: q }, { data: ap }, { data: hi }, { data: ct }] = await Promise.all([
    supabase.from("service_quotations").select("*").eq("request_id", id).order("version", { ascending: false }),
    supabase.from("service_appointments").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("service_request_history").select("id, from_status, to_status, actor_kind, note, created_at").eq("request_id", id).order("id"),
    supabase.from("service_request_contact").select("phone, address_line").eq("request_id", id).maybeSingle(),
  ]);
  const quotes = (q ?? []) as ServiceQuotation[];
  const appointments = (ap ?? []) as ServiceAppointment[];
  const history = (hi ?? []) as ServiceHistoryRow[];
  const contact = ct as { phone: string; address_line: string } | null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/service-requests" className="text-sm text-forest-700 underline">← All service requests</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{req.request_number}</h1><StatusBadge status={req.status} /></div>
        <p className="mt-1 text-sm text-ink/65">{req.service_name} · {req.vendor_name} · Received {formatDateTime(req.created_at)}</p>
      </div>
      <Card><RequestTimeline status={req.status} pricing={req.pricing_model} /><p className="mt-4 text-sm text-ink/70">{REQUEST_STATUS_LABEL[req.status]}{req.decline_reason ? `: ${req.decline_reason}` : ""}{req.cancel_reason ? `: ${req.cancel_reason}` : ""}</p></Card>
      <ServicePaymentNotice />

      <Card>
        <CardTitle>Request</CardTitle>
        <DefinitionList items={[
          { label: "Customer", value: req.customer_name },
          { label: "Phone", value: contact?.phone },
          { label: "Address", value: contact ? [contact.address_line, req.site_city, req.site_pin].join(", ") : `${req.site_city}, ${req.site_pin}` },
          { label: "Type of place", value: req.property_type },
          { label: "Approximate size", value: req.site_size },
          { label: "Pricing", value: req.pricing_model === "fixed" ? `${formatPrice(req.unit_price_inr)} ${PRICE_UNIT_TEXT[req.price_unit ?? ""] ?? ""} × ${req.quantity} = ${formatPrice(req.agreed_total_inr)}` : req.agreed_total_inr !== null ? `Agreed ${formatPrice(req.agreed_total_inr)}` : "Quotation on request" },
          { label: "Preferred time", value: req.preferred_start ? `${formatDateTime(req.preferred_start)} (IST)` : null },
        ]} />
        {req.details ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{req.details}</p> : null}
      </Card>

      {["submitted", "quoted", "accepted", "in_progress"].includes(req.status) ? <Card><CardTitle>Support action</CardTitle><p className="mb-3 text-sm text-ink/70">Cancelling tells both the customer and the provider and frees any booked time. Use it for stuck, duplicate or abusive requests.</p><AdminCancelRequestForm requestId={req.id} /></Card> : null}

      {appointments.length ? <Card><CardTitle>Appointments</CardTitle><ul className="space-y-1 text-sm">{appointments.map((a) => <li key={a.id}>{formatDateTime(a.starts_at)} (IST) · <span className="capitalize">{a.status}</span></li>)}</ul></Card> : null}
      {quotes.length ? (
        <Card><CardTitle>Quotations</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">{quotes.map((x) => <li key={x.id} className="py-3"><span className="font-medium text-forest-950">Version {x.version}: {formatPrice(x.amount_inr)}</span> <span className="capitalize text-ink/65">· {x.status}</span><span className="block text-xs text-ink/65">Valid until {formatDate(x.valid_until)}</span><span className="mt-1 block whitespace-pre-line text-ink/75">{x.description}</span></li>)}</ul>
        </Card>
      ) : null}
      <Card>
        <CardTitle>History</CardTitle>
        <ol className="space-y-2 text-sm">{history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-medium text-forest-950">{REQUEST_STATUS_LABEL[h.to_status]}</span> <span className="text-xs text-ink/65">({h.actor_kind})</span>{h.note ? <span className="text-ink/65"> · {h.note}</span> : null}</span><span className="text-xs text-ink/65">{formatDateTime(h.created_at)}</span></li>)}</ol>
      </Card>
    </div>
  );
}
