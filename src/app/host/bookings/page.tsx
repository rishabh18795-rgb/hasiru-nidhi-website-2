import Link from "next/link";
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
        <div><dt className="text-xs uppercase tracking-wide text-ink/50">Indicative total</dt><dd className="mt-0.5">{b.indicative_total_inr !== null ? formatINR(b.indicative_total_inr) : "Price on request"}</dd></div>
      </dl>
      {b.message ? <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-ink/80"><span className="font-medium">Guest message:</span> {b.message}</p> : null}
      <p className="text-xs text-ink/50">Requested {formatDateTime(b.created_at)}</p>
      {b.status === "requested" ? <RespondToBookingForm bookingId={b.id} /> : null}
      {b.status === "confirmed" && b.check_in >= today ? <HostCancelForm bookingId={b.id} /> : null}
    </Card>
  );
}

const TABS = [
  { value: "requests", label: "Requests" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled & declined" },
  { value: "past", label: "Past stays" },
] as const;

export default async function HostBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = await requireRole(["host"], "/host/bookings");
  const today = todayIST();
  // RLS returns only bookings on this host's own properties.
  const { data } = await supabase.from("bookings").select("*").order("check_in", { ascending: true });
  const all = (data ?? []) as Booking[];
  const groups = {
    requests: all.filter((b) => b.status === "requested"),
    confirmed: all.filter((b) => b.status === "confirmed" && b.check_out > today),
    cancelled: all.filter((b) => ["rejected", "cancelled_by_traveller", "cancelled_by_host"].includes(b.status)).reverse(),
    past: all.filter((b) => b.status === "completed" || (b.status === "confirmed" && b.check_out <= today)).reverse(),
  };
  const tab = TABS.find((t) => t.value === sp.tab)?.value ?? (groups.requests.length ? "requests" : "confirmed");
  const empty = {
    requests: "Nothing is waiting for your response.",
    confirmed: "No confirmed upcoming stays.",
    cancelled: "No cancelled or declined bookings.",
    past: "No past stays yet.",
  } as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Bookings</h1>
        <p className="mt-1 text-sm text-ink/60">Accepting a request confirms the stay and blocks those dates. Two requests for overlapping dates can both wait, but only one can be confirmed.</p>
      </div>
      <nav aria-label="Booking status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.value} href={`/host/bookings?tab=${t.value}`} aria-current={t.value === tab ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm ${t.value === tab ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>
            {t.label} <span className="opacity-70">({groups[t.value].length})</span>
          </Link>
        ))}
      </nav>
      {all.length === 0 ? (
        <EmptyState title="No booking requests yet" description="When a traveller requests one of your live listings, it will appear here." />
      ) : groups[tab].length === 0 ? (
        <p className="text-sm text-ink/55">{empty[tab]}</p>
      ) : (
        <div className="space-y-4">{groups[tab].map((b) => <Row key={b.id} b={b} today={today} />)}</div>
      )}
    </div>
  );
}
