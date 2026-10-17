import type { Metadata } from "next";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { HostCancelForm, RespondToBookingForm } from "@/components/host/host-forms";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR, nightsBetween, todayIST } from "@/lib/format";
import type { Booking } from "@/lib/db/types";

export const metadata: Metadata = { title: "Booking requests" };

function Row({ b, today }: { b: Booking; today: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl text-forest-950">{b.property_name}</p>
          <p className="mt-1 text-sm text-ink/70">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {nightsBetween(b.check_in, b.check_out)} night(s) · {b.adults} adult(s){b.children ? `, ${b.children} child(ren)` : ""}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs uppercase tracking-wide text-ink/50">Guest</dt><dd className="mt-0.5">{b.guest_name || "—"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-ink/50">Contact</dt><dd className="mt-0.5">{b.guest_phone || "—"}<br />{b.guest_email || ""}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-ink/50">Indicative total</dt><dd className="mt-0.5">{b.indicative_total_inr !== null ? formatINR(b.indicative_total_inr) : "On request"}</dd></div>
      </dl>
      {b.message ? <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-ink/80"><span className="font-medium">Guest message:</span> {b.message}</p> : null}
      <p className="text-xs text-ink/50">Requested {formatDateTime(b.created_at)}</p>
      {b.status === "requested" ? <RespondToBookingForm bookingId={b.id} /> : null}
      {b.status === "confirmed" && b.check_in >= today ? <HostCancelForm bookingId={b.id} /> : null}
    </Card>
  );
}

function BookingSection({ title, items, empty, today }: { title: string; items: Booking[]; empty: string; today: string }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-2xl text-forest-950">{title}</h2>
      {items.length ? <div className="space-y-4">{items.map((b) => <Row key={b.id} b={b} today={today} />)}</div> : <p className="text-sm text-ink/55">{empty}</p>}
    </section>
  );
}

export default async function HostBookings() {
  const { supabase } = await requireRole(["host"], "/host/bookings");
  const today = todayIST();
  // RLS returns only bookings on this host's own properties.
  const { data } = await supabase.from("bookings").select("*").order("check_in", { ascending: true });
  const all = (data ?? []) as Booking[];
  const requests = all.filter((b) => b.status === "requested");
  const upcoming = all.filter((b) => b.status === "confirmed" && b.check_out > today);
  const history = all.filter((b) => !requests.includes(b) && !upcoming.includes(b)).reverse();
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Booking requests</h1>
        <p className="mt-1 text-sm text-ink/60">Accepting a request confirms the stay and blocks those dates. Two requests for overlapping dates can both wait, but only one can be confirmed.</p>
      </div>
      {all.length === 0 ? <EmptyState title="No booking requests yet" description="When a traveller requests one of your live listings, it will appear here." /> : (
        <>
          <BookingSection title="Awaiting your response" items={requests} empty="Nothing waiting for you." today={today} />
          <BookingSection title="Upcoming confirmed stays" items={upcoming} empty="No confirmed upcoming stays." today={today} />
          <BookingSection title="History" items={history} empty="No past bookings." today={today} />
        </>
      )}
    </div>
  );
}
