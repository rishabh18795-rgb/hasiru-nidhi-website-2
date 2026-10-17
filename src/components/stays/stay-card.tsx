import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";

import { SampleBadge } from "@/components/app/ui";
import { FALLBACK_PROPERTY_IMAGE, propertyImageUrl } from "@/lib/images";
import { formatINR, PRICE_UNIT_LABEL } from "@/lib/format";
import type { SearchResult } from "@/lib/db/types";

export function StayCard({ stay, query = "" }: { stay: SearchResult; query?: string }) {
  const image = propertyImageUrl(stay.cover_path, stay.cover_source) ?? FALLBACK_PROPERTY_IMAGE;
  const location = [stay.city, stay.state].filter(Boolean).join(", ");
  return (
    <Link
      href={`/stays/${stay.slug}${query}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/10 transition-shadow hover:shadow-xl hover:shadow-forest-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest-50">
        <Image
          src={image}
          alt={stay.cover_alt || `${stay.name} — ${location}`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {stay.is_sample ? <SampleBadge /> : null}
          {stay.is_featured ? (
            <span className="rounded-full bg-sand-400 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Featured</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {stay.category_name ? <p className="text-eyebrow">{stay.category_name}</p> : null}
        <h3 className="mt-2 font-display text-xl text-forest-950">{stay.name}</h3>
        {location ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/60">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {location}
          </p>
        ) : null}
        {stay.summary ? <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink/65">{stay.summary}</p> : null}
        <div className="mt-auto flex items-end justify-between pt-5">
          <p className="flex items-center gap-1.5 text-sm text-ink/60">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Up to {stay.max_guests}
          </p>
          {stay.price_inr !== null ? (
            <p className="text-right">
              <span className="font-display text-lg text-forest-950">{formatINR(stay.price_inr)}</span>
              <span className="block text-xs text-ink/50">{PRICE_UNIT_LABEL[stay.price_unit]}</span>
            </p>
          ) : (
            <p className="text-sm text-ink/55">Price on request</p>
          )}
        </div>
      </div>
    </Link>
  );
}
