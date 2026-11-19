import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";

import { formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import type { ProductCardData } from "@/lib/db/types";

/** A shopper's product card. Real photograph and real price only; a plain labelled placeholder when the seller has no photo. */
export function ProductCard({ product }: { product: ProductCardData }) {
  const image = productImageUrl(product.cover_path);
  const min = Number(product.min_price);
  const max = Number(product.max_price);
  const href = `/shop/p/${product.slug}`;
  const unavailable = !product.is_available;
  const outOfStock = !unavailable && !product.in_stock;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/10 transition-shadow hover:shadow-xl hover:shadow-forest-950/10" data-testid="product-card">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-forest-50" aria-label={`View ${product.name}`} tabIndex={-1}>
        {image ? (
          <Image src={image} alt={product.cover_alt || product.name} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-forest-800/50"><ImageOff className="h-8 w-8" aria-hidden="true" /><span className="text-xs">Photo coming soon</span></span>
        )}
        <span className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.is_featured ? <span className="rounded-full bg-sand-400 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Featured</span> : null}
          {unavailable ? <span className="rounded-full bg-stone-800/85 px-2.5 py-0.5 text-xs font-medium text-white">Currently unavailable</span> : outOfStock ? <span className="rounded-full bg-stone-800/85 px-2.5 py-0.5 text-xs font-medium text-white">Out of stock</span> : null}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-wider text-forest-600">{product.category_name}</p>
        <h3 className="mt-1.5 font-display text-lg leading-snug text-forest-950"><Link href={href} className="hover:underline">{product.name}</Link></h3>
        <p className="mt-1 text-xs text-ink/60">Sold by <Link href={`/vendors/${product.vendor_slug}`} className="underline underline-offset-2 hover:text-forest-800">{product.vendor_name}</Link></p>
        {product.summary ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/65">{product.summary}</p> : null}
        <p className="mt-auto pt-4">
          <span className="font-display text-xl text-forest-950">{min === max ? formatPrice(min) : `${formatPrice(min)}`}</span>
          {min !== max ? <span className="ml-1 text-xs text-ink/55">onwards</span> : null}
        </p>
      </div>
    </article>
  );
}
