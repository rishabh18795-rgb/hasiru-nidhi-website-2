import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { ServicesGate } from "@/components/vendor/capability-gate";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDate, formatPrice } from "@/lib/format";
import { REQUEST_STATUS_SHORT } from "@/lib/services";
import type { ServiceRequest } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Service requests" };

const FILTERS = [["todo", "Needs you"], ["active", "Accepted or in progress"], ["all", "All"], ["closed", "Closed"]] as const;

export default async function VendorServiceRequests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireUser("/vendor/service-requests");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "services")) return <ServicesGate ctx={ctx} />;
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "todo";
  let q = supabase.from("service_requests").select("*").eq("vendor_id", ctx.vendor!.id).order("created_at", { ascending: false }).limit(200);
  if (filter === "todo") q = q.in("status", ["submitted"]);
  else if (filter === "active") q = q.in("status", ["accepted", "in_progress", "quoted"]);
  else if (filter === "closed") q = q.in("status", ["completed", "declined", "cancelled"]);
  const { data } = await q;
  const rows = (data ?? []) as ServiceRequest[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Service requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Requests from customers for your services. You see the area and details from the start; the customer&apos;s phone and address appear once the request is accepted.</p>
      </div>
      <nav aria-label="Filter requests" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => <Link key={k} href={`/vendor/service-requests?status=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
      </nav>
      {rows.length === 0 ? <EmptyState title="No requests here" description={filter === "todo" ? "No requests are waiting for you." : "Nothing matches this filter."} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Where</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Received</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><Link href={`/vendor/service-requests/${r.id}`} className="font-medium text-forest-800 underline">{r.request_number}</Link><span className="block text-xs text-ink/50">{r.customer_name}</span></td>
                  <td className="px-4 py-3 text-ink/80">{r.service_name}</td>
                  <td className="px-4 py-3 text-ink/70">{r.site_city} {r.site_pin}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /><span className="mt-0.5 block text-xs text-ink/55">{REQUEST_STATUS_SHORT[r.status]}</span></td>
                  <td className="px-4 py-3">{r.agreed_total_inr !== null ? formatPrice(r.agreed_total_inr) : <span className="text-ink/40">Quote needed</span>}</td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
