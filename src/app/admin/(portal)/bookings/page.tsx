import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { AdminCancelForm } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { Booking } from "@/lib/db/types";

export const metadata: Metadata = { title: "Bookings" };

const FILTERS = ["all", "requested", "confirmed", "rejected", "cancelled_by_traveller", "cancelled_by_host"] as const;

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as string) : "all";
  const { supabase } = await requireRole(["admin"], "/admin/bookings");
  let q = supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const list = (data ?? []) as Booking[];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Bookings</h1>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => <Link key={f} href={`/admin/bookings?status=${f}`} aria-current={f === status ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm capitalize ${f === status ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>{f.replace(/_/g, " ")}</Link>)}
      </nav>
      {list.length === 0 ? <EmptyState title="No bookings" /> : (
        <ul className="space-y-3">
          {list.map((b) => (
            <li key={b.id}>
              <Card className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-forest-950">{b.property_name}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-ink/70">{formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.guest_name} · {b.adults + b.children} guest(s) · {b.indicative_total_inr !== null ? formatINR(b.indicative_total_inr) : "no price"}</p>
                <p className="text-xs text-ink/45">Requested {formatDateTime(b.created_at)}</p>
                {b.status === "requested" || b.status === "confirmed" ? <AdminCancelForm bookingId={b.id} /> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
