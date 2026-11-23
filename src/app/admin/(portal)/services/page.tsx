import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { servicePriceText } from "@/lib/services";
import type { ServicePricingModel } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Services" };

const FILTERS = [["queue", "Needs review"], ["all", "All"], ["approved", "Live"], ["suspended", "Suspended"], ["rejected", "Rejected"], ["draft", "Drafts"], ["archived", "Archived"]] as const;

interface Row {
  id: string; name: string; status: string; submitted_at: string | null; is_featured: boolean; pricing_model: ServicePricingModel; price_inr: number | string | null; price_unit: string | null;
  vendors: { id: string; business_name: string } | null; service_categories: { name: string } | null;
}

export default async function AdminServices({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole(["admin"], "/admin/services");
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "queue";
  let q = supabase.from("services").select("id, name, status, submitted_at, is_featured, pricing_model, price_inr, price_unit, vendors(id, business_name), service_categories(name)").order("submitted_at", { ascending: true, nullsFirst: false }).limit(200);
  if (filter === "queue") q = q.eq("status", "pending_review");
  else if (filter !== "all") q = q.eq("status", filter);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Services</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Listing approval is separate from provider and capability approval. An approved provider&apos;s service stays private until you approve it here. Oldest submissions first.</p>
      </div>
      <nav aria-label="Filter services" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => <Link key={k} href={`/admin/services?status=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
      </nav>
      {rows.length === 0 ? <EmptyState title="No services here" description={filter === "queue" ? "No services are waiting for review." : "Nothing matches this filter."} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Service</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Pricing</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><Link href={`/admin/services/${r.id}`} className="font-medium text-forest-800 underline">{r.name}</Link>{r.is_featured ? <span className="ml-2 text-xs text-ink/50">featured</span> : null}</td>
                  <td className="px-4 py-3">{r.vendors ? <Link href={`/admin/vendors/${r.vendors.id}`} className="text-ink/80 underline">{r.vendors.business_name}</Link> : "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{r.service_categories?.name}</td>
                  <td className="px-4 py-3">{servicePriceText(r.pricing_model, r.price_inr, r.price_unit)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(r.submitted_at) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
