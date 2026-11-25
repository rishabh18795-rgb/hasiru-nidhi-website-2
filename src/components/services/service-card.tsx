import Image from "next/image";
import Link from "next/link";
import { Clock, ImageOff, MapPin } from "lucide-react";

import { serviceImageUrl } from "@/lib/images";
import { durationText, servicePriceText } from "@/lib/services";
import type { ServiceCardData } from "@/lib/db/types";

/** A visitor's service card. Real photograph and the provider's own price (or "Quotation on request"); nothing invented. */
export function ServiceCard({ service }: { service: ServiceCardData }) {
  const image = serviceImageUrl(service.cover_path);
  const href = `/services/${service.slug}`;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/10 transition-shadow hover:shadow-xl hover:shadow-forest-950/10" data-testid="service-card">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-forest-50" aria-label={`View ${service.name}`} tabIndex={-1}>
        {image ? (
          <Image src={image} alt={service.cover_alt || service.name} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-forest-800/50"><ImageOff className="h-8 w-8" aria-hidden="true" /><span className="text-xs">Photo coming soon</span></span>
        )}
        <span className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {service.is_featured ? <span className="rounded-full bg-sand-400 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Featured</span> : null}
          {!service.is_available ? <span className="rounded-full bg-stone-800/85 px-2.5 py-0.5 text-xs font-medium text-white">Not taking requests</span> : null}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-wider text-forest-600">{service.category_name}</p>
        <h3 className="mt-1.5 font-display text-lg leading-snug text-forest-950"><Link href={href} className="inline-block py-0.5 hover:underline">{service.name}</Link></h3>
        <p className="mt-1 text-xs text-ink/65">By {service.vendor_name}{service.vendor_city ? <span className="ml-1 inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" aria-hidden="true" />{service.vendor_city}</span> : null}</p>
        {service.summary ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/65">{service.summary}</p> : null}
        <p className="mt-auto flex items-end justify-between gap-2 pt-4">
          <span className="font-display text-lg text-forest-950" data-testid="service-price">{servicePriceText(service.pricing_model, service.price_inr, service.price_unit)}</span>
          <span className="inline-flex items-center gap-1 text-xs text-ink/65"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{durationText(service.duration_minutes)}</span>
        </p>
      </div>
    </article>
  );
}
