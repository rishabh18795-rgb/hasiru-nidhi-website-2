import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { ProductsGate } from "@/components/vendor/capability-gate";
import { ProductForm } from "@/components/vendor/product-form";
import { ProductImageManager } from "@/components/vendor/product-image-manager";
import { ProductLifecycle } from "@/components/vendor/product-lifecycle";
import { VariantManager } from "@/components/vendor/variant-manager";
import { requireUser } from "@/lib/auth";
import { getShopCategories } from "@/lib/data/shop";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDateTime } from "@/lib/format";
import { INVENTORY_REASONS, PRODUCT_STATUS_COPY } from "@/lib/validation/product";
import type { InventoryMovement, Product, ProductImage, ProductVariant } from "@/lib/db/types";

export const metadata: Metadata = { title: "Edit product" };

export default async function VendorProductEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/vendor/products/${id}`);
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "products")) return <ProductsGate ctx={ctx} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: p } = await supabase.from("products").select("*").eq("id", id).eq("vendor_id", ctx.vendor!.id).maybeSingle();
  if (!p) notFound();
  const product = p as Product;
  const [categories, { data: v }, { data: im }, { data: mv }, { count: areas }] = await Promise.all([
    getShopCategories(),
    supabase.from("product_variants").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("product_images").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("inventory_movements").select("id, variant_id, delta, balance_after, reason, note, created_at").eq("product_id", id).order("id", { ascending: false }).limit(30),
    supabase.from("vendor_service_areas").select("id", { count: "exact", head: true }).eq("vendor_id", ctx.vendor!.id).eq("scope", "delivery"),
  ]);
  const variants = (v ?? []) as ProductVariant[];
  const images = (im ?? []) as ProductImage[];
  const movements = (mv ?? []) as InventoryMovement[];
  const variantName = new Map(variants.map((x) => [x.id, x.name]));
  const editable = ["draft", "rejected", "approved"].includes(product.status);
  const contentLocked = !editable;
  const missing = [
    images.length === 0 && "at least one photo",
    product.description.trim().length < 30 && "a description of at least 30 characters",
    !variants.some((x) => x.is_active) && "at least one variant with a price",
    (areas ?? 0) === 0 && "delivery PIN codes (Delivery & service areas)",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor/products" className="text-sm text-forest-700 underline">← All products</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{product.name}</h1><StatusBadge status={product.status} /></div>
        <p className="mt-1 text-sm text-ink/65">{PRODUCT_STATUS_COPY[product.status]}</p>
      </div>
      {product.rejection_reason && ["draft", "rejected", "suspended"].includes(product.status) ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Note from our team: {product.rejection_reason}</p> : null}

      <Card>
        <CardTitle>Review and visibility</CardTitle>
        {["draft", "rejected"].includes(product.status) && missing.length ? <p className="mb-3 text-sm text-ink/70">Before you can submit, add: {missing.join("; ")}. {(areas ?? 0) === 0 ? <Link href="/vendor/coverage" className="underline">Set delivery areas</Link> : null}</p> : null}
        <ProductLifecycle productId={product.id} status={product.status} isAvailable={product.is_available} />
      </Card>

      <Card><CardTitle>Details</CardTitle><ProductForm product={product} categories={categories} locked={contentLocked} /></Card>
      <Card><CardTitle>Photos</CardTitle><ProductImageManager vendorId={ctx.vendor!.id} productId={product.id} productName={product.name} images={images.map((i) => ({ id: i.id, path: i.path, alt: i.alt }))} editable={editable} /></Card>
      <Card><CardTitle>Variants, prices and stock</CardTitle><VariantManager productId={product.id} variants={variants} editable={editable} /></Card>
      <Card>
        <CardTitle>Stock history</CardTitle>
        {movements.length === 0 ? <p className="text-sm text-ink/65">No stock changes yet.</p> : (
          <div tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ink/65"><tr><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Variant</th><th className="py-2 pr-3">Change</th><th className="py-2 pr-3">Balance</th><th className="py-2">Reason</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">{movements.map((m) => (
              <tr key={m.id}><td className="py-2 pr-3 text-ink/65">{formatDateTime(m.created_at)}</td><td className="py-2 pr-3">{variantName.get(m.variant_id) ?? "—"}</td><td className={`py-2 pr-3 font-medium ${m.delta > 0 ? "text-forest-700" : "text-red-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td><td className="py-2 pr-3">{m.balance_after}</td><td className="py-2 text-ink/70">{INVENTORY_REASONS[m.reason]}{m.note ? ` · ${m.note}` : ""}</td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
