import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { ProductDecisionForm } from "@/components/admin/product-forms";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { setProductFeatured } from "@/app/admin/product-actions";
import { INVENTORY_REASONS, optionsToText } from "@/lib/validation/product";
import type { InventoryMovement, Product, ProductImage, ProductVariant } from "@/lib/db/types";

export const metadata: Metadata = { title: "Product" };

export default async function AdminProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole(["admin"], `/admin/products/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: p } = await supabase.from("products").select("*, vendors(id, business_name, status, city, state, contact_email, contact_phone), product_categories(name, slug)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const product = p as unknown as Product & { vendors: { id: string; business_name: string; status: string; city: string | null; state: string | null; contact_email: string | null; contact_phone: string | null } | null; product_categories: { name: string; slug: string } | null };
  const [{ data: v }, { data: im }, { data: mv }, { data: caps }, { count: areas }] = await Promise.all([
    supabase.from("product_variants").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("product_images").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("inventory_movements").select("id, variant_id, delta, balance_after, reason, note, created_at").eq("product_id", id).order("id", { ascending: false }).limit(20),
    supabase.from("vendor_capabilities").select("capability, status").eq("vendor_id", product.vendor_id),
    supabase.from("vendor_service_areas").select("id", { count: "exact", head: true }).eq("vendor_id", product.vendor_id).eq("scope", "delivery"),
  ]);
  const variants = (v ?? []) as ProductVariant[];
  const images = (im ?? []) as ProductImage[];
  const movements = (mv ?? []) as InventoryMovement[];
  const productsCap = (caps ?? []).find((c) => c.capability === "products")?.status as string | undefined;
  const vname = new Map(variants.map((x) => [x.id, x.name]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-forest-700 underline">← All products</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{product.name}</h1><StatusBadge status={product.status} />{product.is_featured ? <span className="text-xs text-ink/65">featured</span> : null}</div>
        <p className="mt-1 text-sm text-ink/65">Submitted {product.submitted_at ? formatDateTime(product.submitted_at) : "—"} · /shop/p/{product.slug}</p>
      </div>

      <Card>
        <CardTitle>Seller</CardTitle>
        <DefinitionList items={[
          { label: "Business", value: product.vendors ? <Link href={`/admin/vendors/${product.vendors.id}`} className="underline">{product.vendors.business_name}</Link> : null },
          { label: "Business status", value: product.vendors?.status },
          { label: "Products capability", value: productsCap },
          { label: "Location", value: [product.vendors?.city, product.vendors?.state].filter(Boolean).join(", ") },
          { label: "Contact", value: [product.vendors?.contact_phone, product.vendors?.contact_email].filter(Boolean).join(" · ") },
          { label: "Delivery PIN coverage", value: (areas ?? 0) > 0 ? `${areas} entries listed` : "None listed: the product cannot be delivered anywhere" },
        ]} />
      </Card>

      <Card>
        <CardTitle>Decision</CardTitle>
        <ProductDecisionForm productId={product.id} status={product.status} />
        {product.rejection_reason ? <p className="mt-3 text-sm text-ink/65">Last note recorded: {product.rejection_reason}</p> : null}
        {product.status === "approved" ? (
          <form action={setProductFeatured.bind(null, product.id, !product.is_featured)} className="mt-4"><button type="submit" className="h-9 rounded-full border border-forest-900/20 px-4 text-sm font-medium text-forest-900 hover:bg-forest-50">{product.is_featured ? "Remove from featured" : "Feature on the Shop landing page"}</button></form>
        ) : null}
      </Card>

      <Card>
        <CardTitle>What the seller submitted</CardTitle>
        <DefinitionList items={[
          { label: "Category", value: product.product_categories?.name },
          { label: "Brand", value: product.brand },
          { label: "Summary", value: product.summary },
          { label: "Availability", value: product.is_available ? "Selling" : "Paused by the seller" },
        ]} />
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{product.description || <span className="text-ink/65">No description.</span>}</p>
        {product.attributes.length ? <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{product.attributes.map((a) => <div key={a.label}><dt className="text-xs uppercase tracking-wide text-ink/65">{a.label}</dt><dd>{a.value}</dd></div>)}</dl> : null}
      </Card>

      <Card>
        <CardTitle>Photos</CardTitle>
        {images.length === 0 ? <p className="text-sm text-ink/65">No photos.</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((i) => <li key={i.id} className="relative aspect-square overflow-hidden rounded-xl bg-forest-50"><Image src={productImageUrl(i.path) ?? ""} alt={i.alt || product.name} fill sizes="20vw" className="object-cover" unoptimized={!productImageUrl(i.path)} /></li>)}</ul>
        )}
      </Card>

      <Card>
        <CardTitle>Variants and stock</CardTitle>
        {variants.length === 0 ? <p className="text-sm text-ink/65">No variants.</p> : (
          <div tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ink/65"><tr><th className="py-2 pr-3">Variant</th><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">Options</th><th className="py-2 pr-3">Price</th><th className="py-2">Stock</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">{variants.map((x) => <tr key={x.id}><td className="py-2 pr-3">{x.name}{!x.is_active ? <span className="ml-2 text-xs text-ink/65">not offered</span> : null}</td><td className="py-2 pr-3 text-ink/65">{x.sku}</td><td className="whitespace-pre-line py-2 pr-3 text-xs text-ink/65">{optionsToText(x.options) || "—"}</td><td className="py-2 pr-3">{formatPrice(x.price_inr)}</td><td className="py-2">{x.track_inventory ? x.stock_on_hand : "Not tracked"}</td></tr>)}</tbody></table></div>
        )}
        {movements.length ? (
          <>
            <h3 className="mb-2 mt-6 text-sm font-medium text-forest-950">Recent stock movements</h3>
            <ul className="space-y-1 text-sm text-ink/70">{movements.map((m) => <li key={m.id}><span className={m.delta > 0 ? "text-forest-700" : "text-red-700"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span> · {vname.get(m.variant_id)} · {INVENTORY_REASONS[m.reason]} · balance {m.balance_after} <span className="text-xs text-ink/65">({formatDateTime(m.created_at)})</span></li>)}</ul>
          </>
        ) : null}
      </Card>
    </div>
  );
}
