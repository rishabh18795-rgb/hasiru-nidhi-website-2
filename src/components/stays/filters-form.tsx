import Link from "next/link";
import { X } from "lucide-react";

import { NativeSelect, TextInput } from "@/components/forms/fields";
import { SORT_OPTIONS, type StayFilters } from "@/lib/stays/filters";
import type { Catalog } from "@/lib/data/catalog";

/** Server-rendered filter form (GET). `idPrefix` keeps ids unique when rendered twice (mobile + desktop). */
export function StayFiltersForm({
  filters,
  catalog,
  idPrefix,
  hasAnyFilter,
}: {
  filters: StayFilters;
  catalog: Catalog;
  idPrefix: string;
  hasAnyFilter: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <form action="/stays" method="get" className="flex flex-col gap-5 p-5">
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.checkin ? <input type="hidden" name="checkin" value={filters.checkin} /> : null}
      {filters.checkout ? <input type="hidden" name="checkout" value={filters.checkout} /> : null}
      <div>
        <label htmlFor={id("category")} className="text-sm font-medium text-forest-950">Property type</label>
        <NativeSelect id={id("category")} name="category" defaultValue={filters.category} className="mt-1.5">
          <option value="">All types</option>
          {catalog.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("min")} className="text-sm font-medium text-forest-950">Min ₹</label>
          <TextInput id={id("min")} name="min" type="number" min={0} step={500} defaultValue={filters.min ?? ""} className="mt-1.5" />
        </div>
        <div>
          <label htmlFor={id("max")} className="text-sm font-medium text-forest-950">Max ₹</label>
          <TextInput id={id("max")} name="max" type="number" min={0} step={500} defaultValue={filters.max ?? ""} className="mt-1.5" />
        </div>
      </div>
      <p className="-mt-3 text-xs text-ink/50">Budget filters only match listings whose host has published a price.</p>
      <div>
        <label htmlFor={id("guests")} className="text-sm font-medium text-forest-950">Guests</label>
        <TextInput id={id("guests")} name="guests" type="number" min={1} max={500} defaultValue={filters.guests ?? ""} className="mt-1.5" />
      </div>
      {catalog.amenities.length ? (
        <fieldset>
          <legend className="text-sm font-medium text-forest-950">Facilities</legend>
          <div className="mt-2 flex flex-col gap-2">
            {catalog.amenities.map((a) => (
              <label key={a.slug} className="flex items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" name="amenities" value={a.slug} defaultChecked={filters.amenities.includes(a.slug)} className="h-4 w-4 accent-forest-700" />
                {a.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {catalog.experiences.length ? (
        <fieldset>
          <legend className="text-sm font-medium text-forest-950">Experiences</legend>
          <div className="mt-2 flex flex-col gap-2">
            {catalog.experiences.map((e) => (
              <label key={e.slug} className="flex items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" name="experiences" value={e.slug} defaultChecked={filters.experiences.includes(e.slug)} className="h-4 w-4 accent-forest-700" />
                {e.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div>
        <label htmlFor={id("sort")} className="text-sm font-medium text-forest-950">Sort by</label>
        <NativeSelect id={id("sort")} name="sort" defaultValue={filters.sort} className="mt-1.5">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </div>
      <div className="flex gap-3">
        <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Apply filters</button>
        {hasAnyFilter ? (
          <Link href="/stays" className="inline-flex h-10 items-center gap-1 rounded-full border border-forest-900/20 px-4 text-sm text-forest-900 hover:bg-forest-50">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
