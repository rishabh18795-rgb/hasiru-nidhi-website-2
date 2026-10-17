import Link from "next/link";
import type { Metadata } from "next";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { CancelBookingForm, ReviewForm } from "@/components/dashboard/booking-forms";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR, todayIST } from "@/lib/format";
import { cancellationPolicies } from "@/lib/validation/property";
import type { Booking } from "@/lib/db/types";

export const metadata: Metadata = { title: "My bookings" };

type Row = Booking & { properties: { slug: string } | null };

function BookingCard({ b, today, reviewed }: { b: Row; today: string; reviewed: boolean }) {
  const policy = cancellationPolicies.find((p) => p.value === b.cancellation_policy)?.label ?? b.cancellation_policy;
  const finished = b.status === "confirmed" && b.check_out <= today;
  const cancellable = (b.status === "requested" || b.status === "confirmed") && !(b.status === "confirmed" && b.check_in < today);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {b.properties ? (
            <Link href={`/stays/${b.properties.slug}`} className="font-display text-xl text-forest-950 hover:underline">{b.property_name}</Link>
          ) : (
            <p className="font-display text-xl text-forest-950">{b.property_name}</p>
          )}
          <p className="mt-1 text-sm text-ink/65">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.adults} adult{b.adults === 1 ? "" : "s"}{b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}</p>
        </div>
        <StatusBadge status={finished ? "completed" : b.status} />
      </div>
      {b.status === "requested" ? <p className="rounded-xl bg-sand-50 px-4 py-2.5 text-sm text-earth-800">Waiting for the host. This is a request — it is not a confirmed reservation.</p> : null}
      {b.host_response ? <p className="text-sm text-ink/75"><span className="font-medium">Host note:</span> {b.host_response}</p> : null}
      <dl className="grid gap-3 text-xs text-ink/60 sm:grid-cols-3">
        <div><dt className="uppercase tracking-wide">Requested</dt><dd className="mt-0.5 text-ink/80">{formatDateTime(b.created_at)}</dd></div>
        <div><dt className="uppercase tracking-wide">Indicative total</dt><dd className="mt-0.5 text-ink/80">{b.indicative_total_inr !== null ? formatINR(b.indicative_total_inr) : "On request"}</dd></div>
        <div><dt className="uppercase tracking-wide">Cancellation</dt><dd className="mt-0.5 text-ink/80">{b.cancellation_policy}</dd></div>
      </dl>
      {b.cancelled_at ? <p className="text-xs text-ink/55">Cancelled {formatDateTime(b.cancelled_at)}{b.cancellation_note ? ` — ${b.cancellation_note}` : ""}</p> : null}
      {cancellable ? <CancelBookingForm bookingId={b.id} policyText={policy} /> : null}
      {finished && !reviewed ? <ReviewForm bookingId={b.id} /> : null}
    </Card>
  );
}

function BookingSection({ title, items, empty, today, reviewedIds }: { title: string; items: Row[]; empty: string; today: string; reviewedIds: Set<string> }) {
  const id = title.replace(/\s/g, "-");
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-4 font-display text-2xl text-forest-950">{title}</h2>
      {items.length ? <div className="space-y-4">{items.map((b) => <BookingCard key={b.id} b={b} today={today} reviewed={reviewedIds.has(b.id)} />)}</div> : <p className="text-sm text-ink/55">{empty}</p>}
    </section>
  );
}

export default async function BookingsPage() {
  const { supabase, user } = await requireUser("/dashboard/bookings");
  const today = todayIST();
  const [{ data }, { data: rev }] = await Promise.all([
    supabase.from("bookings").select("*, properties(slug)").eq("traveller_id", user.id).order("created_at", { ascending: false }),
    supabase.from("reviews").select("booking_id").eq("traveller_id", user.id),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const reviewedIds = new Set((rev ?? []).map((r) => r.booking_id as string));
  const pending = rows.filter((b) => b.status === "requested");
  const confirmed = rows.filter((b) => b.status === "confirmed" && b.check_out > today);
  const past = rows.filter((b) => !pending.includes(b) && !confirmed.includes(b));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">My bookings</h1>
        <p className="mt-1 text-sm text-ink/60">Requests, confirmed stays and your history.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No bookings yet" description="When you request a stay it will show up here with its status." action={{ href: "/stays", label: "Explore stays" }} />
      ) : (
        <>
          <BookingSection title="Upcoming requests" items={pending} empty="No requests awaiting a host." today={today} reviewedIds={reviewedIds} />
          <BookingSection title="Confirmed bookings" items={confirmed} empty="No confirmed upcoming stays." today={today} reviewedIds={reviewedIds} />
          <BookingSection title="Past and closed" items={past} empty="Nothing here yet." today={today} reviewedIds={reviewedIds} />
        </>
      )}
    </div>
  );
}
