import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState } from "@/components/app/ui";
import { ProductsGate } from "@/components/vendor/capability-gate";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDateTime, formatPrice } from "@/lib/format";
import { INVENTORY_REASONS } from "@/lib/validation/product";

export const metadata: Metadata = { title: "Inventory" };

interface VariantRow { id: string; sku: string; name: string; price_inr: number; stock_on_hand: number; track_inventory: boolean; is_active: boolean; products: { id: string; name: string; status: string } | null }
interface MoveRow { id: number; delta: number; balance_after: number; reason: string; note: string | null; created_at: string; product_variants: { name: string; sku: string } | null; products: { id: string; name: string } | null }

export default async function VendorInventoryPage() {
  const { supabase, user } = await requireUser("/vendor/inventory");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "products")) return <ProductsGate ctx={ctx} />;
  const [{ data: vs }, { data: ms }] = await Promise.all([
    supabase.from("product_variants").select("id, sku, name, price_inr, stock_on_hand, track_inventory, is_active, products!inner(id, name, status, vendor_id)").eq("products.vendor_id", ctx.vendor!.id),
    supabase.from("inventory_movements").select("id, delta, balance_after, reason, note, created_at, product_variants(name, sku), products(id, name)").eq("vendor_id", ctx.vendor!.id).order("id", { ascending: false }).limit(40),
  ]);
  const variants = ((vs ?? []) as unknown as VariantRow[]).filter((v) => v.products?.status !== "archived").sort((a, b) => (a.track_inventory === b.track_inventory ? a.stock_on_hand - b.stock_on_hand : a.track_inventory ? -1 : 1));
  const moves = (ms ?? []) as unknown as MoveRow[];
  const out = variants.filter((v) => v.track_inventory && v.is_active && v.stock_on_hand === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Inventory</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Every variant and its stock, lowest first. Open a product to adjust stock; each change is recorded in its history. {out ? <strong className="text-red-700">{out} active variant{out === 1 ? " is" : "s are"} out of stock.</strong> : null}</p>
      </div>
      {variants.length === 0 ? <EmptyState title="No variants yet" description="Variants appear here once you add them to a product." action={{ href: "/vendor/products", label: "Go to products" }} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/65"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Stock</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {variants.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3"><Link href={`/vendor/products/${v.products?.id}`} className="text-forest-800 underline">{v.products?.name}</Link></td>
                  <td className="px-4 py-3">{v.name}{!v.is_active ? <span className="ml-2 text-xs text-ink/65">not offered</span> : null}</td>
                  <td className="px-4 py-3 text-ink/65">{v.sku}</td>
                  <td className="px-4 py-3">{formatPrice(v.price_inr)}</td>
                  <td className={`px-4 py-3 font-medium ${v.track_inventory && v.stock_on_hand === 0 ? "text-red-700" : ""}`}>{v.track_inventory ? v.stock_on_hand : <span className="font-normal text-ink/65">Not tracked</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Card>
        <h2 className="mb-3 font-display text-xl text-forest-950">Recent stock movements</h2>
        {moves.length === 0 ? <p className="text-sm text-ink/65">No stock changes yet.</p> : (
          <ul className="divide-y divide-forest-900/8 text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><span className={`font-medium ${m.delta > 0 ? "text-forest-700" : "text-red-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span> · {m.products?.name} · {m.product_variants?.name}<span className="text-ink/65"> · {INVENTORY_REASONS[m.reason]}{m.note ? ` · ${m.note}` : ""}</span></span>
                <span className="text-xs text-ink/65">{formatDateTime(m.created_at)} · balance {m.balance_after}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
