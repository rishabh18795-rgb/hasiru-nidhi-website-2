import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { ProductsGate } from "@/components/vendor/capability-gate";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDate, formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";

export const metadata: Metadata = { title: "Products" };

interface Row {
  id: string; name: string; status: string; updated_at: string; is_available: boolean;
  product_categories: { name: string } | null;
  product_variants: { price_inr: number; stock_on_hand: number; is_active: boolean; track_inventory: boolean }[];
  product_images: { path: string; sort_order: number }[];
}

export default async function VendorProductsPage() {
  const { supabase, user } = await requireUser("/vendor/products");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "products")) return <ProductsGate ctx={ctx} />;
  const { data } = await supabase.from("products")
    .select("id, name, status, updated_at, is_available, product_categories(name), product_variants(price_inr, stock_on_hand, is_active, track_inventory), product_images(path, sort_order)")
    .eq("vendor_id", ctx.vendor!.id).order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-forest-950">Products</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/65">Create products, add photos and variants, then submit them for review. Nothing is public until our team approves the product and the Shop is open.</p>
        </div>
        <Link href="/vendor/products/new" className="inline-flex h-11 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">New product</Link>
      </div>
      {rows.length === 0 ? <EmptyState title="No products yet" description="Start with a draft. You can save it and come back before submitting." action={{ href: "/vendor/products/new", label: "Create your first product" }} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/65"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => {
                const active = r.product_variants.filter((v) => v.is_active);
                const prices = active.map((v) => Number(v.price_inr));
                const cover = [...r.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
                const tracked = active.filter((v) => v.track_inventory);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/vendor/products/${r.id}`} className="flex items-center gap-3">
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest-50">{cover ? <Image src={productImageUrl(cover.path) ?? ""} alt="" fill sizes="48px" className="object-cover" unoptimized={!productImageUrl(cover.path)} /> : null}</span>
                        <span><span className="font-medium text-forest-800 underline">{r.name}</span><span className="block text-xs text-ink/65">{r.product_categories?.name}</span></span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} />{r.status === "approved" && !r.is_available ? <span className="ml-2 text-xs text-ink/65">paused</span> : null}</td>
                    <td className="px-4 py-3 text-ink/80">{prices.length ? (Math.min(...prices) === Math.max(...prices) ? formatPrice(prices[0]) : `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`) : <span className="text-ink/65">No variants</span>}</td>
                    <td className="px-4 py-3 text-ink/80">{tracked.length ? tracked.reduce((t, v) => t + v.stock_on_hand, 0) : active.length ? "Not tracked" : "—"}</td>
                    <td className="px-4 py-3 text-ink/65">{formatDate(r.updated_at)}</td>
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
