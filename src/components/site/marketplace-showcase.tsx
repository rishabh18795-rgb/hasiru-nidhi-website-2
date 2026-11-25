import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ProductCard } from "@/components/shop/product-card";
import { ServiceCard } from "@/components/services/service-card";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { getMarketplaceFlags } from "@/lib/flags";
import { searchProducts } from "@/lib/data/shop";
import { searchServices } from "@/lib/data/services";
import { parseShopFilters } from "@/lib/shop/filters";
import { parseServiceFilters } from "@/lib/services/filters";

/**
 * Home-page window onto the marketplace. It renders ONLY when an administrator has switched Shop and/or Services on AND real approved
 * listings exist, so an empty or switched-off marketplace never shows a hollow section. Nothing here is invented: cards are the same
 * ones shoppers see in /shop and /services, with the sellers' own photographs and prices.
 */
export async function MarketplaceShowcase() {
  const flags = await getMarketplaceFlags();
  if (!flags.products && !flags.services) return null;
  const [products, services] = await Promise.all([
    flags.products ? searchProducts(parseShopFilters({}), null, { featured: false, limit: 4 }) : null,
    flags.services ? searchServices(parseServiceFilters({}), { limit: 3 }) : null,
  ]);
  const productList = products?.results ?? [];
  const serviceList = services?.results ?? [];
  if (productList.length === 0 && serviceList.length === 0) return null;

  const more = "inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900";
  return (
    <section aria-labelledby="home-market-heading" className="bg-cream py-20 sm:py-24">
      <div className="container-nidhi">
        <SectionHeading
          eyebrow="The Marketplace"
          title="From growers, makers and local experts."
          description="Plants, produce and handmade goods from verified local sellers, and gardeners and guides you can ask for a quotation. Prices are the sellers' own; every seller is reviewed by our team."
        />
        <h2 id="home-market-heading" className="sr-only">Shop and services</h2>

        {productList.length > 0 ? (
          <div className="mt-14">
            <div className="flex items-end justify-between gap-4 border-b border-forest-900/10 pb-4">
              <h3 className="font-display text-2xl text-forest-950">Shop</h3>
              <Link href="/shop" className={more}>Browse the shop <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {productList.map((p, i) => <li key={p.id}><Reveal delay={i * 0.06} className="h-full [&>article]:h-full"><ProductCard product={p} /></Reveal></li>)}
            </ul>
          </div>
        ) : null}

        {serviceList.length > 0 ? (
          <div className="mt-16">
            <div className="flex items-end justify-between gap-4 border-b border-forest-900/10 pb-4">
              <h3 className="font-display text-2xl text-forest-950">Services</h3>
              <Link href="/services" className={more}>Browse services <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {serviceList.map((s, i) => <li key={s.id}><Reveal delay={i * 0.06} className="h-full [&>article]:h-full"><ServiceCard service={s} /></Reveal></li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
