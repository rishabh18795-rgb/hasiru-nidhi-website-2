import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, StatusBadge } from "@/components/app/ui";
import { PaymentBadge } from "@/components/orders/payment-notice";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { REQUEST_STATUS_SHORT } from "@/lib/services";
import type { ServiceRequest } from "@/lib/db/types";

export const metadata: Metadata = { title: "Service requests" };

export default async function ServiceRequestsPage() {
  const { supabase, user } = await requireUser("/dashboard/requests");
  const { data } = await supabase.from("service_requests").select("*").eq("customer_id", user.id).order("created_at", { ascending: false });
  const rows = (data ?? []) as ServiceRequest[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Service requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Requests you sent to service providers, with their quotations and appointments. Your earlier gardening enquiries are handled by our team and are unchanged.</p>
      </div>
      {rows.length === 0 ? <EmptyState title="No service requests yet" description="When you request a service or ask for a quotation, it appears here with live status updates." action={{ href: "/services", label: "Browse services" }} /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/requests/${r.id}`} className="block rounded-2xl bg-white p-5 ring-1 ring-forest-900/10 transition-shadow hover:shadow-md" data-testid="request-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-950">{r.service_name}</p>
                    <p className="text-xs text-ink/55">{r.vendor_name} · {r.request_number} · {formatDate(r.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-xs font-medium text-ink/70">{REQUEST_STATUS_SHORT[r.status]}</span>
                    {r.agreed_total_inr !== null ? <span className="font-display text-lg text-forest-950">{formatPrice(r.agreed_total_inr)}</span> : <span className="text-xs text-ink/55">Awaiting quotation</span>}
                  </div>
                </div>
                <div className="mt-3"><PaymentBadge /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
