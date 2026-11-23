import Link from "next/link";

import { SHOP_SORTS, type ShopFilters } from "@/lib/shop/filters";
import { controlClass } from "@/components/forms/fields";

/** A plain GET form: filters live in the URL, so results are shareable and work without client JavaScript. */
export function ShopFiltersForm({ filters, basePath, idPrefix, hasAnyFilter }: { filters: ShopFilters; basePath: string; idPrefix: string; hasAnyFilter: boolean }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const field = `${controlClass} h-10`;
  return (
    <form method="get" action={basePath} className="flex flex-col gap-5 p-5">
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.vendor ? <input type="hidden" name="vendor" value={filters.vendor} /> : null}
      <div>
        <label htmlFor={id("pin")} className="text-sm font-medium text-forest-950">Deliver to PIN code</label>
        <input id={id("pin")} name="pin" inputMode="numeric" maxLength={6} defaultValue={filters.pin} placeholder="e.g. 560078" className={`${field} mt-1.5`} />
        <p className="mt-1 text-xs text-ink/65">Shows only sellers who deliver to this PIN.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-forest-950">Price (₹)</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <input name="min" inputMode="decimal" defaultValue={filters.min ?? ""} placeholder="Min" aria-label="Minimum price" className={field} />
          <input name="max" inputMode="decimal" defaultValue={filters.max ?? ""} placeholder="Max" aria-label="Maximum price" className={field} />
        </div>
      </fieldset>
      <label className="flex items-center gap-2.5 text-sm text-ink/80"><input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} className="h-4 w-4 accent-forest-700" /> In stock only</label>
      <div>
        <label htmlFor={id("sort")} className="text-sm font-medium text-forest-950">Sort by</label>
        <select id={id("sort")} name="sort" defaultValue={filters.sort} className={`${field} mt-1.5`}>{SHOP_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Apply filters</button>
        {hasAnyFilter ? <Link href={basePath} className="text-sm text-forest-700 underline">Clear all</Link> : null}
      </div>
    </form>
  );
}
