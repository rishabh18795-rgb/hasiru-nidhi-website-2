import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, SlidersHorizontal } from "lucide-react";

import { ProductCard } from "@/components/shop/product-card";
import { ShopFiltersForm } from "@/components/shop/shop-filters";
import { ShopNotOpen } from "@/components/shop/shop-notice";
import { getMarketplaceFlags } from "@/lib/flags";
import { getShopCategories, searchProducts } from "@/lib/data/shop";
import { SHOP_PAGE_SIZE, activeShopFilterCount, parseShopFilters, shopFiltersToQuery } from "@/lib/shop/filters";
import { cn } from "@/lib/utils";

type Params = Promise<{ category: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const cats = await getShopCategories();
  const c = cats.find((x) => x.slug === category);
  const title = category === "all" ? "All products" : c?.name ?? "Shop";
  return {
    title: `${title}: Shop`,
    description: c?.description ?? "Browse products from verified sellers on Hasiru Nidhi and check delivery to your PIN code.",
    alternates: { canonical: `/shop/${category}` },
    robots: { index: false, follow: true }, // filtered and paged views are not indexed; the category landing is listed once products exist
  };
}

export default async function ShopCategoryPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { category } = await params;
  if (!(await getMarketplaceFlags()).products) return <ShopNotOpen />;
  const cats = await getShopCategories();
  const current = category === "all" ? null : cats.find((c) => c.slug === category);
  if (category !== "all" && !current) notFound();

  const filters = parseShopFilters(await searchParams);
  const outcome = await searchProducts(filters, current?.slug ?? null);
  const base = `/shop/${category}`;
  const filterCount = activeShopFilterCount(filters);
  const hasAnyFilter = Boolean(filters.q) || filterCount > 0;
  const totalPages = Math.max(1, Math.ceil(outcome.total / SHOP_PAGE_SIZE));
  const title = filters.q && !current ? `Results for “${filters.q}”` : current?.name ?? "All products";

  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink/65"><Link href="/shop" className="inline-block py-2 hover:underline">Shop</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span aria-current="page" className="text-ink/80">{current?.name ?? "All products"}</span></nav>
        <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">{title}</h1>
        {current?.description ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">{current.description}</p> : null}

        <nav aria-label="Categories" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {[{ slug: "all", name: "All" }, ...cats].map((c) => (
            <Link key={c.slug} href={`/shop/${c.slug}${shopFiltersToQuery({ ...filters, page: 1 })}`} aria-current={c.slug === category ? "page" : undefined}
              className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium", c.slug === category ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{c.name}</Link>
          ))}
        </nav>

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside>
            <details className="rounded-2xl border border-forest-900/10 bg-white lg:hidden" open={filterCount > 0}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-forest-950"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}</summary>
              <div className="border-t border-forest-900/10"><ShopFiltersForm filters={filters} basePath={base} idPrefix="m" hasAnyFilter={hasAnyFilter} /></div>
            </details>
            <div className="hidden rounded-2xl border border-forest-900/10 bg-white lg:block">
              <p className="flex items-center gap-2 border-b border-forest-900/10 px-5 py-3.5 text-sm font-medium text-forest-950"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}</p>
              <ShopFiltersForm filters={filters} basePath={base} idPrefix="d" hasAnyFilter={hasAnyFilter} />
            </div>
          </aside>

          <div>
            <p className="text-sm text-ink/65" aria-live="polite">{outcome.error ? "" : `${outcome.total} ${outcome.total === 1 ? "product" : "products"}${filters.pin ? ` delivering to ${filters.pin}` : ""}`}</p>
            {outcome.error ? (
              <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">We couldn&apos;t load products right now. Nothing is shown in its place. <a href={`${base}${shopFiltersToQuery(filters)}`} className="underline">Retry</a></div>
            ) : outcome.results.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-14 text-center">
                <p className="font-display text-xl text-forest-950">{hasAnyFilter ? "No products match these filters" : current ? `No ${current.name.toLowerCase()} are listed yet` : "No products are listed yet"}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">{hasAnyFilter ? "Try a different PIN code, a wider price range, or clear the filters." : "Products appear here only after a verified seller lists them and our team approves them."}</p>
                <Link href={hasAnyFilter ? base : "/shop"} className="mt-5 inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">{hasAnyFilter ? "Clear all filters" : "Back to the Shop"}</Link>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-3 xl:gap-6">{outcome.results.map((p) => <ProductCard key={p.id} product={p} />)}</div>
                {totalPages > 1 ? (
                  <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                    {filters.page > 1 ? <Link rel="prev" href={`${base}${shopFiltersToQuery({ ...filters, page: filters.page - 1 })}`} className="rounded-full border border-forest-900/20 bg-white px-5 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">Previous</Link> : null}
                    <span className="text-sm text-ink/65">Page {filters.page} of {totalPages}</span>
                    {filters.page < totalPages ? <Link rel="next" href={`${base}${shopFiltersToQuery({ ...filters, page: filters.page + 1 })}`} className="rounded-full border border-forest-900/20 bg-white px-5 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">Next</Link> : null}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
