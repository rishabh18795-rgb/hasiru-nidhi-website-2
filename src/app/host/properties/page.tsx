import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Pencil, Plus } from "lucide-react";

import { Card, EmptyState, SampleBadge, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Property } from "@/lib/db/types";

export const metadata: Metadata = { title: "My properties" };

export default async function HostProperties({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireRole(["host"], "/host/properties");
  const { data } = await supabase.from("properties").select("*").eq("host_id", user.id).order("updated_at", { ascending: false });
  const list = (data ?? []) as Property[];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">My properties</h1>
        <Link href="/host/properties/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700"><Plus className="h-4 w-4" aria-hidden="true" /> Add a property</Link>
      </div>
      {sp.deleted ? <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Draft deleted.</p> : null}
      {list.length === 0 ? (
        <EmptyState title="You haven't added a property yet" action={{ href: "/host/properties/new", label: "Add your first property" }} />
      ) : (
        <ul className="space-y-4">
          {list.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl text-forest-950">{p.name}</p>
                    {p.is_sample ? <SampleBadge /> : null}
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{[p.city, p.state].filter(Boolean).join(", ") || "Location not set"} · updated {formatDate(p.updated_at)}</p>
                  {p.status === "rejected" && p.rejection_reason ? <p className="mt-2 text-sm text-red-700">Rejected: {p.rejection_reason}</p> : null}
                  {p.status === "suspended" && p.rejection_reason ? <p className="mt-2 text-sm text-red-700">Suspended: {p.rejection_reason}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/host/properties/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-900/20 px-4 text-sm text-forest-900 hover:bg-forest-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit</Link>
                  <Link href={`/host/properties/${p.id}/availability`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-900/20 px-4 text-sm text-forest-900 hover:bg-forest-50"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Calendar</Link>
                  {p.status === "approved" ? <Link href={`/stays/${p.slug}`} className="inline-flex h-9 items-center rounded-full bg-forest-50 px-4 text-sm text-forest-800 hover:bg-forest-100">View live</Link> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
