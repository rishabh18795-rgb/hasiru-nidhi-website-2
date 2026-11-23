import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { REQUEST_STATUS_SHORT } from "@/lib/services";
import type { ServiceRequest } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Service requests" };

const FILTERS = [["open", "Open"], ["all", "All"], ["completed", "Completed"], ["declined", "Declined"], ["cancelled", "Cancelled"]] as const;

export default async function AdminServiceRequests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole(["admin"], "/admin/service-requests");
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "open";
  let q = supabase.from("service_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter === "open") q = q.in("status", ["submitted", "quoted", "accepted", "in_progress"]);
  else if (filter !== "all") q = q.eq("status", filter);
  const { data } = await q;
  const rows = (data ?? []) as ServiceRequest[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Service requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Every request between customers and providers. You can cancel a stuck or abusive request with a recorded reason. All requests are unpaid: payment is not configured.</p>
      </div>
      <nav aria-label="Filter requests" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => <Link key={k} href={`/admin/service-requests?status=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
      </nav>
      {rows.length === 0 ? <EmptyState title="No requests here" description="Nothing matches this filter." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Received</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><Link href={`/admin/service-requests/${r.id}`} className="font-medium text-forest-800 underline">{r.request_number}</Link><span className="block text-xs text-ink/50">{r.customer_name}</span></td>
                  <td className="px-4 py-3 text-ink/80">{r.service_name}</td>
                  <td className="px-4 py-3 text-ink/70">{r.vendor_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /><span className="mt-0.5 block text-xs text-ink/55">{REQUEST_STATUS_SHORT[r.status]}</span></td>
                  <td className="px-4 py-3">{r.agreed_total_inr !== null ? formatPrice(r.agreed_total_inr) : <span className="text-ink/40">No quote yet</span>}</td>
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
