import Link from "next/link";

import { SERVICE_SORTS, type ServiceFilters } from "@/lib/services/filters";
import { controlClass } from "@/components/forms/fields";

/** A plain GET form: filters live in the URL, so results are shareable and work without client JavaScript. */
export function ServiceFiltersForm({ filters, basePath, idPrefix, hasAnyFilter }: { filters: ServiceFilters; basePath: string; idPrefix: string; hasAnyFilter: boolean }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const field = `${controlClass} h-10`;
  return (
    <form method="get" action={basePath} className="flex flex-col gap-5 p-5">
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.vendor ? <input type="hidden" name="vendor" value={filters.vendor} /> : null}
      {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
      <div>
        <label htmlFor={id("pin")} className="text-sm font-medium text-forest-950">Service at PIN code</label>
        <input id={id("pin")} name="pin" inputMode="numeric" maxLength={6} defaultValue={filters.pin} placeholder="e.g. 560078" className={`${field} mt-1.5`} />
        <p className="mt-1 text-xs text-ink/65">Shows only providers who serve this PIN.</p>
      </div>
      <div>
        <label htmlFor={id("pricing")} className="text-sm font-medium text-forest-950">Pricing</label>
        <select id={id("pricing")} name="pricing" defaultValue={filters.pricing} className={`${field} mt-1.5`}>
          <option value="">Any</option><option value="fixed">Fixed price</option><option value="quote">Quotation on request</option>
        </select>
      </div>
      <div>
        <label htmlFor={id("sort")} className="text-sm font-medium text-forest-950">Sort by</label>
        <select id={id("sort")} name="sort" defaultValue={filters.sort} className={`${field} mt-1.5`}>{SERVICE_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Apply filters</button>
        {hasAnyFilter ? <Link href={basePath} className="text-sm text-forest-700 underline">Clear all</Link> : null}
      </div>
    </form>
  );
}
