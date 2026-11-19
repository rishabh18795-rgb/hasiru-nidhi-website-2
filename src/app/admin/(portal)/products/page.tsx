import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

const FILTERS = [["queue", "Needs review"], ["all", "All"], ["approved", "Live"], ["suspended", "Suspended"], ["rejected", "Rejected"], ["draft", "Drafts"], ["archived", "Archived"]] as const;

interface Row {
  id: string; name: string; status: string; submitted_at: string | null; is_featured: boolean;
  vendors: { id: string; business_name: string } | null; product_categories: { name: string } | null;
  product_variants: { price_inr: number; is_active: boolean }[];
}

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole(["admin"], "/admin/products");
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "queue";
  let q = supabase.from("products").select("id, name, status, submitted_at, is_featured, vendors(id, business_name), product_categories(name), product_variants(price_inr, is_active)").order("submitted_at", { ascending: true, nullsFirst: false }).limit(200);
  if (filter === "queue") q = q.eq("status", "pending_review");
  else if (filter !== "all") q = q.eq("status", filter);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Products</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Product approval is separate from vendor and capability approval. An approved vendor&apos;s product stays private until you approve it here. Oldest submissions first.</p>
      </div>
      <nav aria-label="Filter products" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => <Link key={k} href={`/admin/products?status=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
      </nav>
      {rows.length === 0 ? <EmptyState title="No products here" description={filter === "queue" ? "No products are waiting for review." : "Nothing matches this filter."} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Price from</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => {
                const prices = r.product_variants.filter((v) => v.is_active).map((v) => Number(v.price_inr));
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><Link href={`/admin/products/${r.id}`} className="font-medium text-forest-800 underline">{r.name}</Link>{r.is_featured ? <span className="ml-2 text-xs text-ink/50">featured</span> : null}</td>
                    <td className="px-4 py-3">{r.vendors ? <Link href={`/admin/vendors/${r.vendors.id}`} className="text-ink/80 underline">{r.vendors.business_name}</Link> : "—"}</td>
                    <td className="px-4 py-3 text-ink/70">{r.product_categories?.name}</td>
                    <td className="px-4 py-3">{prices.length ? formatPrice(Math.min(...prices)) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-ink/60">{formatDate(r.submitted_at) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
