import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Store } from "lucide-react";

import { PurchasePanel } from "@/components/shop/purchase-panel";
import { ShopNotOpen } from "@/components/shop/shop-notice";
import { ProductGallery } from "@/components/shop/product-gallery";
import { getMarketplaceFlags } from "@/lib/flags";
import { getPublicProduct } from "@/lib/data/shop";
import { getPublicReviews } from "@/lib/data/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { productImageUrl } from "@/lib/images";
import { siteConfig } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) return { title: "Shop", robots: { index: false, follow: true } };
  return {
    title: `${product.name}: ${product.category.name}`,
    description: [product.summary, product.description].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 155),
    alternates: { canonical: `/shop/p/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!(await getMarketplaceFlags()).products) return <ShopNotOpen />;
  const product = await getPublicProduct(slug);
  if (!product) notFound();

  const reviews = await getPublicReviews("product", product.slug);
  const photos = product.images.map((i) => ({ src: productImageUrl(i.path) ?? "", alt: i.alt || product.name })).filter((i) => i.src);
  const prices = product.variants.map((v) => Number(v.price_inr));
  // Structured data only from facts we hold: name, description, photos, and the real price and availability.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary || product.description.slice(0, 300),
    image: photos.map((p) => p.src),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    category: product.category.name,
    offers: {
      "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length,
      availability: product.is_available && product.variants.some((v) => v.in_stock) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.vendor.business_name }, url: `${siteConfig.url}/shop/p/${product.slug}/`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-cream pb-20 pt-32">
        <div className="container-nidhi">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink/65">
            <Link href="/shop" className="inline-block py-2 hover:underline">Shop</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link href={`/shop/${product.category.slug}`} className="hover:underline">{product.category.name}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-current="page" className="text-ink/80">{product.name}</span>
          </nav>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              {photos.length ? <ProductGallery images={photos} name={product.name} /> : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-forest-50 text-sm text-forest-800/60">The seller hasn&apos;t added a photo yet.</div>
              )}
            </div>
            <div>
              <p className="text-eyebrow">{product.category.name}</p>
              <h1 className="mt-2 font-display text-3xl leading-tight text-forest-950 sm:text-4xl">{product.name}</h1>
              <p className="mt-2 text-sm text-ink/65">Sold by <Link href={`/vendors/${product.vendor.slug}`} className="font-medium underline underline-offset-2 hover:text-forest-800">{product.vendor.business_name}</Link>{product.brand ? <> · Brand: {product.brand}</> : null}</p>
              {product.summary ? <p className="mt-4 text-base leading-relaxed text-ink/75">{product.summary}</p> : null}
              <div className="mt-6"><PurchasePanel productId={product.id} variants={product.variants} isAvailable={product.is_available} ordersOpen={Boolean(product.orders_enabled)} slug={product.slug} /></div>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-2xl text-forest-950">About this product</h2>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-ink/75">{product.description}</p>
              {product.attributes.length ? (
                <>
                  <h2 className="mt-8 font-display text-2xl text-forest-950">Specifications</h2>
                  <dl className="mt-3 divide-y divide-forest-900/10 rounded-2xl border border-forest-900/10 bg-white text-sm">
                    {product.attributes.map((a) => <div key={a.label} className="grid grid-cols-[10rem_1fr] gap-3 px-4 py-3"><dt className="text-ink/65">{a.label}</dt><dd className="text-ink/85">{a.value}</dd></div>)}
                  </dl>
                </>
              ) : null}
              <div className="mt-10"><ReviewList reviews={reviews} noun="product" /></div>
            </div>
            <aside className="h-fit space-y-6">
            <div className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10" data-testid="return-policy">
              <h2 className="font-display text-xl text-forest-950">Returns and replacements</h2>
              {product.return_policy ? (
                <ul className="mt-3 space-y-1.5 text-sm text-ink/75">
                  <li>Returns: {product.return_policy.returns_allowed === null ? "not decided yet" : product.return_policy.returns_allowed ? `accepted${product.return_policy.return_window_days ? ` within ${product.return_policy.return_window_days} days of delivery` : ""}` : "not accepted for this category"}</li>
                  <li>Replacements: {product.return_policy.replacements_allowed === null ? "not decided yet" : product.return_policy.replacements_allowed ? `accepted${product.return_policy.replacement_window_days ? ` within ${product.return_policy.replacement_window_days} days of delivery` : ""}` : "not accepted for this category"}</li>
                  {product.return_policy.notes ? <li>{product.return_policy.notes}</li> : null}
                </ul>
              ) : <p className="mt-3 text-sm leading-relaxed text-ink/70">A return and replacement policy for this category has not been set yet. If something is wrong after delivery you can still send a request, and the seller and our team will decide.</p>}
            </div>
            <div className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10">
              <h2 className="flex items-center gap-2 font-display text-xl text-forest-950"><Store className="h-5 w-5" aria-hidden="true" /> About the seller</h2>
              <p className="mt-3 font-medium text-forest-950">{product.vendor.business_name}</p>
              {product.vendor.city ? <p className="text-sm text-ink/65">{[product.vendor.city, product.vendor.state].filter(Boolean).join(", ")}</p> : null}
              {product.vendor.description ? <p className="mt-3 text-sm leading-relaxed text-ink/70">{product.vendor.description}</p> : null}
              <p className="mt-3 text-xs text-ink/65">This seller has been verified by Hasiru Nidhi. They ship their own orders.</p>
              <Link href={`/vendors/${product.vendor.slug}`} className="mt-4 inline-flex h-10 items-center rounded-full border border-forest-900/20 px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">View all products from this seller</Link>
            </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
