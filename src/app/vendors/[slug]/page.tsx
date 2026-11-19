import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";

import { ProductCard } from "@/components/shop/product-card";
import { ShopNotOpen } from "@/components/shop/shop-notice";
import { getMarketplaceFlags } from "@/lib/flags";
import { getVendorStore, searchProducts } from "@/lib/data/shop";
import { SHOP_PAGE_SIZE, parseShopFilters, shopFiltersToQuery } from "@/lib/shop/filters";

type Params = Promise<{ slug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getVendorStore(slug);
  return store
    ? { title: `${store.business_name}: seller on Hasiru Nidhi`, description: (store.description || `Products from ${store.business_name}, a verified Hasiru Nidhi seller.`).slice(0, 155), alternates: { canonical: `/vendors/${store.slug}` } }
    : { title: "Seller", robots: { index: false, follow: true } };
}

export default async function VendorStorePage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { slug } = await params;
  if (!(await getMarketplaceFlags()).products) return <ShopNotOpen />;
  const store = await getVendorStore(slug);
  if (!store) notFound();
  const filters = { ...parseShopFilters(await searchParams), vendor: store.slug };
  const outcome = await searchProducts(filters, null);
  const totalPages = Math.max(1, Math.ceil(outcome.total / SHOP_PAGE_SIZE));
  const base = `/vendors/${store.slug}`;

  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi">
        <p className="text-eyebrow">Seller</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">{store.business_name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/60">{store.city ? <><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{[store.city, store.state].filter(Boolean).join(", ")} · </> : null}{store.product_count} {store.product_count === 1 ? "product" : "products"}</p>
        {store.description ? <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink/70">{store.description}</p> : null}
        <p className="mt-3 text-xs text-ink/55">Verified by Hasiru Nidhi. This seller ships their own orders to the PIN codes they have listed.</p>

        {outcome.error ? (
          <div role="alert" className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">We couldn&apos;t load this seller&apos;s products right now. <a href={base} className="underline">Retry</a></div>
        ) : outcome.results.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-14 text-center"><p className="font-display text-xl text-forest-950">No products listed right now</p><Link href="/shop" className="mt-5 inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Back to the Shop</Link></div>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">{outcome.results.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {totalPages > 1 ? (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                {filters.page > 1 ? <Link rel="prev" href={`${base}${shopFiltersToQuery({ page: filters.page - 1 })}`} className="rounded-full border border-forest-900/20 bg-white px-5 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">Previous</Link> : null}
                <span className="text-sm text-ink/60">Page {filters.page} of {totalPages}</span>
                {filters.page < totalPages ? <Link rel="next" href={`${base}${shopFiltersToQuery({ page: filters.page + 1 })}`} className="rounded-full border border-forest-900/20 bg-white px-5 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">Next</Link> : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
