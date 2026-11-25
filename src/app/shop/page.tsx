import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPinned, ShieldCheck, Truck } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { LinkButton } from "@/components/site/link-button";
import { CategoryIcon } from "@/components/shop/category-icon";
import { ProductCard } from "@/components/shop/product-card";
import { ShopNotOpen } from "@/components/shop/shop-notice";
import { getMarketplaceFlags } from "@/lib/flags";
import { getShopCategories, searchProducts } from "@/lib/data/shop";
import { parseShopFilters } from "@/lib/shop/filters";
import { images } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const open = (await getMarketplaceFlags()).products;
  return {
    title: "Shop: plants, tools, compost and farm produce",
    description: "Plants, seeds, gardening tools, organic fertilisers, handmade goods and farm produce from verified sellers. Check delivery to your PIN code.",
    alternates: { canonical: "/shop" },
    robots: open ? undefined : { index: false, follow: true },
  };
}

// The landing page is cached briefly, so an administrator switching the Shop ON or OFF is reflected within seconds even without a deploy.
export const revalidate = 15;

const PROMISES = [
  { icon: ShieldCheck, title: "Verified sellers, reviewed listings", copy: "Every seller is verified by our team and every product is reviewed before it appears." },
  { icon: MapPinned, title: "Delivery where sellers deliver", copy: "Each seller lists the PIN codes they serve, and we check against them. We never assume delivery everywhere." },
  { icon: Truck, title: "Shipped by the seller", copy: "Sellers ship their own orders. Charges and timelines are shown once they are confirmed." },
];

export default async function ShopPage() {
  if (!(await getMarketplaceFlags()).products) return <ShopNotOpen />;
  const filters = parseShopFilters({});
  const [categories, featured, latest] = await Promise.all([
    getShopCategories(),
    searchProducts(filters, null, { featured: true, limit: 4 }),
    searchProducts(filters, null, { limit: 8 }),
  ]);
  const hasProducts = latest.total > 0;

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title="From the garden to your doorstep."
        description="Plants, tools, compost, handmade goods and farm produce from verified sellers, delivered only where they deliver."
        image={images.gardeningTools}
        imagePosition="50% 18%"
        crumb="Shop"
      />

      <section className="relative z-10 -mt-10 pb-4">
        <div className="container-nidhi">
          <form action="/shop/all" method="get" role="search" aria-label="Search the shop" className="glass grid gap-3 rounded-3xl p-4 shadow-xl shadow-forest-950/10 sm:grid-cols-[1fr_12rem_auto] sm:p-5">
            <label className="sr-only" htmlFor="shop-q">Search products</label>
            <input id="shop-q" name="q" placeholder="Search plants, tools, compost, produce…" className="h-12 rounded-2xl border border-forest-900/15 bg-white px-4 text-sm outline-none focus-visible:border-forest-500 focus-visible:ring-2 focus-visible:ring-forest-500/30" />
            <label className="sr-only" htmlFor="shop-pin">Delivery PIN code</label>
            <input id="shop-pin" name="pin" inputMode="numeric" maxLength={6} placeholder="Delivery PIN code" className="h-12 rounded-2xl border border-forest-900/15 bg-white px-4 text-sm outline-none focus-visible:border-forest-500 focus-visible:ring-2 focus-visible:ring-forest-500/30" />
            <button type="submit" className="inline-flex h-12 items-center justify-center rounded-full bg-forest-800 px-7 text-sm font-medium text-cream hover:bg-forest-700">Search</button>
          </form>
        </div>
      </section>

      <section className="bg-cream py-16" aria-labelledby="cats-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Shop by category" title="Everything for a greener life." />
          <h2 id="cats-heading" className="sr-only">Categories</h2>
          {categories.length === 0 ? <p className="mt-8 text-sm text-ink/65">Categories are being set up.</p> : (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/shop/${c.slug}`} className="group flex h-full items-start gap-4 rounded-3xl bg-white p-5 ring-1 ring-forest-900/10 transition-shadow hover:shadow-lg hover:shadow-forest-950/10 focus-visible:outline-2 focus-visible:outline-forest-600">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-800 text-cream"><CategoryIcon slug={c.slug} className="h-6 w-6" /></span>
                    <span className="min-w-0"><span className="flex items-center gap-1 font-display text-lg text-forest-950">{c.name}<ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" /></span>{c.description ? <span className="mt-1 block text-sm text-ink/65">{c.description}</span> : null}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {featured.results.length ? (
        <section className="bg-forest-50 py-16" aria-labelledby="featured-heading">
          <div className="container-nidhi">
            <SectionHeading eyebrow="Featured" title="Chosen by our team." />
            <h2 id="featured-heading" className="sr-only">Featured products</h2>
            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">{featured.results.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>
      ) : null}

      <section className="bg-cream py-16" aria-labelledby="latest-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow={hasProducts ? "New arrivals" : "Coming soon"} title={hasProducts ? "Fresh from our sellers." : "Our first products are on the way."} />
          <h2 id="latest-heading" className="sr-only">Latest products</h2>
          {hasProducts ? (
            <>
              <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">{latest.results.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              <div className="mt-8"><LinkButton href="/shop/all" variant="outline" size="lg" className="rounded-full border-forest-800/25 px-7 text-forest-900 hover:bg-forest-900/5">View all products</LinkButton></div>
            </>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-14 text-center">
              <p className="font-display text-xl text-forest-950">No products are listed yet</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink/65">Products appear here only after a verified seller lists them and our team approves them. We never show sample products as if they were real.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <LinkButton href="/become-a-vendor" className="rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700">Become a vendor</LinkButton>
                <LinkButton href="/stays" variant="outline" className="rounded-full border-forest-800/25 px-6 text-forest-900 hover:bg-forest-900/5">Explore nature stays</LinkButton>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-forest-950 py-16 text-cream" aria-labelledby="promise-heading">
        <div className="container-nidhi">
          <h2 id="promise-heading" className="font-display text-3xl">How the Shop works</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {PROMISES.map((p) => (
              <li key={p.title} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <p.icon className="h-6 w-6 text-sand-300" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/75">{p.copy}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-cream/75">Ordering and online payment open in a later release. Today you can browse, compare and check delivery.</p>
        </div>
      </section>
    </>
  );
}
