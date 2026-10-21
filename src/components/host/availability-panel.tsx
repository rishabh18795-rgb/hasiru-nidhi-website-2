import type { SupabaseClient } from "@supabase/supabase-js";

import { Card, CardTitle } from "@/components/app/ui";
import { BlockDatesForm } from "@/components/host/host-forms";
import { AvailabilityCalendar } from "@/components/stays/availability-calendar";
import { formatDate, todayIST } from "@/lib/format";
import { unblockDates } from "@/app/host/actions";
import type { AvailabilityBlock, Booking } from "@/lib/db/types";

/**
 * The host's availability tools: a calendar of blocked and confirmed nights, a form to block dates, and the lists behind it.
 * Shared by the wizard's Availability step and the standalone calendar page. Every date is the default "open";
 * the database refuses blocks that overlap a confirmed booking and refuses bookings that overlap a block.
 */
export async function AvailabilityPanel({ supabase, propertyId }: { supabase: SupabaseClient; propertyId: string }) {
  const today = todayIST();
  const [{ data: blocks }, { data: confirmed }, { data: requested }] = await Promise.all([
    supabase.from("availability_blocks").select("*").eq("property_id", propertyId).gte("end_date", today).order("start_date"),
    supabase.from("bookings").select("check_in, check_out, guest_name").eq("property_id", propertyId).eq("status", "confirmed").gte("check_out", today).order("check_in"),
    supabase.from("bookings").select("check_in, check_out, guest_name").eq("property_id", propertyId).eq("status", "requested").gte("check_out", today).order("check_in"),
  ]);
  const blockList = (blocks ?? []) as AvailabilityBlock[];
  const confirmedList = (confirmed ?? []) as Pick<Booking, "check_in" | "check_out" | "guest_name">[];
  const requestedList = (requested ?? []) as Pick<Booking, "check_in" | "check_out" | "guest_name">[];
  const ranges = [
    ...blockList.map((b) => ({ start_date: b.start_date, end_date: b.end_date })),
    ...confirmedList.map((b) => ({ start_date: b.check_in, end_date: b.check_out })),
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Next three months</CardTitle>
        <AvailabilityCalendar ranges={ranges} />
        <p className="mt-3 text-xs text-ink/60">Every date is open unless it is blocked or already confirmed. Shaded dates can&apos;t be booked.</p>
      </Card>
      <Card><CardTitle>Block dates</CardTitle><BlockDatesForm propertyId={propertyId} minDate={today} /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Blocked by you</CardTitle>
          {blockList.length === 0 ? <p className="text-sm text-ink/55">No blocked dates.</p> : (
            <ul className="divide-y divide-forest-900/8">
              {blockList.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{formatDate(b.start_date)} → {formatDate(b.end_date)}{b.reason ? <span className="text-ink/55"> · {b.reason}</span> : null}</span>
                  <form action={unblockDates.bind(null, b.id, propertyId)}><button type="submit" className="text-red-700 underline underline-offset-2">Unblock</button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Bookings on these dates</CardTitle>
          {confirmedList.length + requestedList.length === 0 ? <p className="text-sm text-ink/55">No upcoming bookings or requests.</p> : (
            <ul className="divide-y divide-forest-900/8">
              {confirmedList.map((b, i) => <li key={`c${i}`} className="py-3 text-sm">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.guest_name} <span className="ml-1 rounded-full bg-forest-100 px-2 py-0.5 text-xs text-forest-800">Confirmed</span></li>)}
              {requestedList.map((b, i) => <li key={`r${i}`} className="py-3 text-sm">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.guest_name} <span className="ml-1 rounded-full bg-sand-100 px-2 py-0.5 text-xs text-earth-700">Requested</span></li>)}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink/60">Confirmed stays can&apos;t be blocked over, so you can&apos;t accidentally overwrite a reservation.</p>
        </Card>
      </div>
    </div>
  );
}
