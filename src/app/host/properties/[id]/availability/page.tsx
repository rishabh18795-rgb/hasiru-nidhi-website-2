import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Card, CardTitle } from "@/components/app/ui";
import { BlockDatesForm } from "@/components/host/host-forms";
import { AvailabilityCalendar } from "@/components/stays/availability-calendar";
import { requireRole } from "@/lib/auth";
import { formatDate, todayIST } from "@/lib/format";
import { unblockDates } from "@/app/host/actions";
import type { AvailabilityBlock, Booking } from "@/lib/db/types";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await requireRole(["host"], `/host/properties/${id}/availability`);
  const { data: p } = await supabase.from("properties").select("id, name").eq("id", id).eq("host_id", user.id).maybeSingle();
  if (!p) notFound();
  const today = todayIST();
  const [{ data: blocks }, { data: confirmed }] = await Promise.all([
    supabase.from("availability_blocks").select("*").eq("property_id", id).gte("end_date", today).order("start_date"),
    supabase.from("bookings").select("check_in, check_out, guest_name").eq("property_id", id).eq("status", "confirmed").gte("check_out", today).order("check_in"),
  ]);
  const blockList = (blocks ?? []) as AvailabilityBlock[];
  const confirmedList = (confirmed ?? []) as Pick<Booking, "check_in" | "check_out" | "guest_name">[];
  const ranges = [
    ...blockList.map((b) => ({ start_date: b.start_date, end_date: b.end_date })),
    ...confirmedList.map((b) => ({ start_date: b.check_in, end_date: b.check_out })),
  ];
  return (
    <div className="space-y-8">
      <div>
        <Link href={`/host/properties/${id}`} className="text-sm text-forest-700 underline">← {p.name}</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">Availability calendar</h1>
        <p className="mt-1 text-sm text-ink/60">Block dates you can&apos;t host. Confirmed bookings block dates automatically, and you can&apos;t block nights that already have a confirmed stay.</p>
      </div>
      <Card><CardTitle>Next three months</CardTitle><AvailabilityCalendar ranges={ranges} /></Card>
      <Card><CardTitle>Block dates</CardTitle><BlockDatesForm propertyId={id} minDate={today} /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Blocked by you</CardTitle>
          {blockList.length === 0 ? <p className="text-sm text-ink/55">No blocked dates.</p> : (
            <ul className="divide-y divide-forest-900/8">
              {blockList.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{formatDate(b.start_date)} → {formatDate(b.end_date)}{b.reason ? <span className="text-ink/55"> · {b.reason}</span> : null}</span>
                  <form action={unblockDates.bind(null, b.id, id)}><button type="submit" className="text-red-700 underline underline-offset-2">Unblock</button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Confirmed bookings</CardTitle>
          {confirmedList.length === 0 ? <p className="text-sm text-ink/55">No upcoming confirmed bookings.</p> : (
            <ul className="divide-y divide-forest-900/8">
              {confirmedList.map((b, i) => <li key={i} className="py-3 text-sm">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.guest_name}</li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
