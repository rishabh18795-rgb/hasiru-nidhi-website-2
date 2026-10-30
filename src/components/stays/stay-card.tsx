import Image from "next/image";
import Link from "next/link";
import { BedDouble, Bath, MapPin, Users } from "lucide-react";

import { SampleBadge } from "@/components/app/ui";
import { FALLBACK_PROPERTY_IMAGE, propertyImageUrl } from "@/lib/images";
import { formatINR, PRICE_UNIT_LABEL } from "@/lib/format";
import type { SearchResult } from "@/lib/db/types";
import type { BookingSelection } from "@/lib/stays/booking-links";
import { selectionQuery, stayHref } from "@/lib/stays/booking-links";

const MAX_CHIPS = 4;

/**
 * A result card on Explore Stays: photograph, type, location, capacity, rooms, amenities, price and two clear actions.
 * `base` is "/stays" for live listings and "/demo/stays" for the built-in demo mode.
 */
export function StayCard({ stay, selection = {}, base = "/stays" }: { stay: SearchResult; selection?: BookingSelection; base?: string }) {
  const image = propertyImageUrl(stay.cover_path, stay.cover_source) ?? FALLBACK_PROPERTY_IMAGE;
  const location = [stay.city, stay.state].filter(Boolean).join(", ");
  const detail = `${base}/${stay.slug}${selectionQuery(selection)}`;
  const book = stayHref(stay.slug, selection, base);
  const amenities = stay.amenity_names ?? [];
  const btn = "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40";
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/10 transition-shadow hover:shadow-xl hover:shadow-forest-950/10" data-testid="stay-card">
      <Link href={detail} className="relative block aspect-[4/3] overflow-hidden bg-forest-50" aria-label={`View details: ${stay.name}`} tabIndex={-1}>
        <Image
          src={image}
          alt={stay.cover_alt || `${stay.name} — ${location}`}
          fill
          sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
          {stay.is_sample ? <SampleBadge /> : null}
          {stay.is_featured ? <span className="rounded-full bg-sand-400 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Featured</span> : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {stay.category_name ? <p className="text-eyebrow">{stay.category_name}</p> : null}
        <h3 className="mt-2 font-display text-xl text-forest-950">
          <Link href={detail} className="hover:underline">{stay.name}</Link>
        </h3>
        {location ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/60">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {location}
          </p>
        ) : null}
        {stay.summary ? <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink/65">{stay.summary}</p> : null}

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink/70" aria-label="Capacity">
          <li className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Up to {stay.max_guests} guests</li>
          {stay.bedrooms !== null && stay.bedrooms !== undefined ? <li className="flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" aria-hidden="true" /> {stay.bedrooms} bedroom{stay.bedrooms === 1 ? "" : "s"}</li> : null}
          {stay.bathrooms !== null && stay.bathrooms !== undefined ? <li className="flex items-center gap-1.5"><Bath className="h-3.5 w-3.5" aria-hidden="true" /> {stay.bathrooms} bathroom{Number(stay.bathrooms) === 1 ? "" : "s"}</li> : null}
        </ul>

        {amenities.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Amenities">
            {amenities.slice(0, MAX_CHIPS).map((a) => <li key={a} className="rounded-full bg-forest-50 px-2.5 py-1 text-xs text-forest-800">{a}</li>)}
            {amenities.length > MAX_CHIPS ? <li className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-ink/60">+{amenities.length - MAX_CHIPS} more</li> : null}
          </ul>
        ) : null}

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between">
            {stay.price_inr !== null ? (
              <p>
                <span className="font-display text-xl text-forest-950">{formatINR(stay.price_inr)}</span>{" "}
                <span className="text-xs text-ink/55">{PRICE_UNIT_LABEL[stay.price_unit]}</span>
                {stay.is_sample ? <span className="block text-[11px] font-medium uppercase tracking-wide text-amber-800">Illustrative demo price</span> : null}
              </p>
            ) : (
              <p className="text-sm text-ink/55">Price on request</p>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Link href={detail} className={`${btn} border border-forest-900/25 text-forest-900 hover:bg-forest-50`}>View Details</Link>
            <Link href={book} className={`${btn} bg-forest-800 text-cream hover:bg-forest-700`}>Book Now</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
