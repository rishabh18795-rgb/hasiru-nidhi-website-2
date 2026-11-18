import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Card, DefinitionList, StatusBadge } from "@/components/app/ui";
import { CancelBookingForm } from "@/components/dashboard/booking-forms";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR, nightsBetween, todayIST } from "@/lib/format";
import { cancellationPolicies } from "@/lib/validation/property";
import type { Booking, BookingFinancial } from "@/lib/db/types";

export const metadata: Metadata = { title: "Booking details" };

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "No payment recorded yet", initiated: "Payment started", paid: "Paid", failed: "Payment failed", partially_refunded: "Partly refunded", refunded: "Refunded",
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/dashboard/bookings/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  // Row Level Security: a customer can only ever read their own booking, so any other id is simply "not found".
  const { data } = await supabase.from("bookings").select("*, properties(slug)").eq("id", id).eq("traveller_id", user.id).maybeSingle();
  if (!data) notFound();
  const b = data as unknown as Booking & { properties: { slug: string } | null };
  const [{ data: history }, { data: fin }] = await Promise.all([
    supabase.from("booking_status_history").select("from_status, to_status, created_at").eq("booking_id", id).order("id"),
    supabase.from("booking_financials").select("payment_status").eq("booking_id", id).maybeSingle(),
  ]);
  const payment = (fin as Pick<BookingFinancial, "payment_status"> | null)?.payment_status ?? "unpaid";
  const q = b.price_breakdown;
  const today = todayIST();
  const policy = cancellationPolicies.find((p) => p.value === b.cancellation_policy)?.label ?? b.cancellation_policy;
  const cancellable = (b.status === "requested" || b.status === "confirmed") && !(b.status === "confirmed" && b.check_in < today);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/bookings" className="text-sm text-forest-700 underline underline-offset-2">← My bookings</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-medium tracking-tight text-forest-950">
            {b.properties ? <Link href={`/stays/${b.properties.slug}`} className="hover:underline">{b.property_name}</Link> : b.property_name}
          </h1>
          <StatusBadge status={b.status} />
        </div>
      </div>

      {b.status === "requested" ? <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">Waiting for the host. This is a request, not a confirmed reservation.</p> : null}

      <Card className="space-y-4">
        <h2 className="text-lg font-medium text-forest-950">Your stay</h2>
        <DefinitionList items={[
          { label: "Check-in", value: formatDate(b.check_in) },
          { label: "Check-out", value: formatDate(b.check_out) },
          { label: "Nights", value: nightsBetween(b.check_in, b.check_out) },
          { label: "Guests", value: `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}` },
          { label: "Requested", value: formatDateTime(b.created_at) },
          { label: "Cancellation policy", value: policy },
        ]} />
        {b.message ? <p className="text-sm text-ink/75"><span className="font-medium">Your message:</span> {b.message}</p> : null}
        {b.host_response ? <p className="text-sm text-ink/75"><span className="font-medium">Host note:</span> {b.host_response}</p> : null}
        {b.cancelled_at ? <p className="text-xs text-ink/55">Cancelled {formatDateTime(b.cancelled_at)}{b.cancellation_note ? ` — ${b.cancellation_note}` : ""}</p> : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-medium text-forest-950">Price breakdown</h2>
        {q ? (
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Stay ({q.nights} night{q.nights === 1 ? "" : "s"}{q.weekend_nights ? `, ${q.weekend_nights} weekend` : ""})</dt><dd>{formatINR(q.base)}</dd></div>
            {q.extra_guests > 0 ? <div className="flex justify-between"><dt>Extra guests</dt><dd>{formatINR(q.extra_guests)}</dd></div> : null}
            {q.cleaning > 0 ? <div className="flex justify-between"><dt>Cleaning fee</dt><dd>{formatINR(q.cleaning)}</dd></div> : null}
            {q.tax > 0 ? <div className="flex justify-between"><dt>Tax ({q.tax_percent}%)</dt><dd>{formatINR(q.tax)}</dd></div> : null}
            <div className="flex justify-between border-t border-forest-900/10 pt-2 font-medium text-forest-950"><dt>Total</dt><dd>{formatINR(q.total)}</dd></div>
          </dl>
        ) : <p className="text-sm text-ink/65">Price on request.</p>}
        <p className="text-xs text-ink/55">Payment status: <span className="font-medium text-ink/75">{PAYMENT_LABEL[payment] ?? payment}</span>. The platform does not take online payments yet; payment is arranged as described in the booking confirmation and our <Link href="/cancellation-policy" className="underline">Cancellation Policy</Link>.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-medium text-forest-950">Status history</h2>
        <ol className="space-y-2 text-sm">
          {((history ?? []) as { from_status: string | null; to_status: string; created_at: string }[]).map((h, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={h.to_status} /><time className="text-xs text-ink/55" dateTime={h.created_at}>{formatDateTime(h.created_at)}</time></li>
          ))}
        </ol>
      </Card>

      {cancellable ? <CancelBookingForm bookingId={b.id} policyText={policy} /> : null}
    </div>
  );
}
