import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState, StatusBadge } from "@/components/app/ui";
import { AvailabilityPanel } from "@/components/host/availability-panel";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Calendar" };

/** One calendar for all of a host's properties: pick a property, then block dates or see confirmed and requested stays. */
export default async function HostCalendar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireRole(["host"], "/host/calendar");
  const { data } = await supabase.from("properties").select("id, name, status").eq("host_id", user.id).order("name");
  const props = (data ?? []) as { id: string; name: string; status: string }[];
  const current = props.find((p) => p.id === sp.property) ?? props[0];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Calendar</h1>
        <p className="mt-1 text-sm text-ink/60">Block dates you can&apos;t host and see confirmed and requested stays. Confirmed bookings block dates automatically.</p>
      </div>
      {props.length === 0 || !current ? (
        <EmptyState title="No properties yet" description="Add a property to manage its availability." action={{ href: "/host/properties/new", label: "Add a property" }} />
      ) : (
        <>
          {props.length > 1 ? (
            <nav aria-label="Choose a property" className="flex flex-wrap gap-2">
              {props.map((p) => (
                <Link key={p.id} href={`/host/calendar?property=${p.id}`} aria-current={p.id === current.id ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-sm ${p.id === current.id ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>{p.name}</Link>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl text-forest-950">{current.name}</h2><StatusBadge status={current.status} /></div>
          <AvailabilityPanel supabase={supabase} propertyId={current.id} />
        </>
      )}
    </div>
  );
}
