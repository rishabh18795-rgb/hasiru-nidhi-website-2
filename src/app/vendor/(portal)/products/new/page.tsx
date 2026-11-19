import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/app/ui";
import { ProductsGate } from "@/components/vendor/capability-gate";
import { ProductForm } from "@/components/vendor/product-form";
import { requireUser } from "@/lib/auth";
import { getShopCategories } from "@/lib/data/shop";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase, user } = await requireUser("/vendor/products/new");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "products")) return <ProductsGate ctx={ctx} />;
  const categories = await getShopCategories();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor/products" className="text-sm text-forest-700 underline">← All products</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">New product</h1>
        <p className="mt-1 text-sm text-ink/60">Start with the basics. After you save, you can add photos, variants with prices and stock, and submit it for review.</p>
      </div>
      <Card><CardTitle>Product details</CardTitle><ProductForm product={null} categories={categories} /></Card>
    </div>
  );
}
