import Link from "next/link";
import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";

import { BackendNotice } from "@/components/site/backend-notice";
import { StayCard } from "@/components/stays/stay-card";
import { StaySearchBar } from "@/components/stays/search-bar";
import { StayFiltersForm } from "@/components/stays/filters-form";
import { getCatalog } from "@/lib/data/catalog";
import { searchStays } from "@/lib/data/stays";
import {
  PAGE_SIZE, activeFilterCount, parseStayFilters, stayFiltersToQuery,
} from "@/lib/stays/filters";

export const metadata: Metadata = {
  title: "Explore nature stays in Karnataka",
  description: "Search farm stays, cottages, eco-retreats and family getaways across Karnataka. Filter by dates, guests, budget, amenities and experiences.",
  alternates: { canonical: "/stays" },
};

export default async function StaysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseStayFilters(await searchParams);
  const [catalog, outcome] = await Promise.all([getCatalog(), searchStays(filters)]);
  const filterCount = activeFilterCount(filters);
  const totalPages = Math.max(1, Math.ceil(outcome.total / PAGE_SIZE));
  const hasAnyFilter = Boolean(filters.q) || filterCount > 0;
  const dateQuery = filters.checkin && filters.checkout ? `?checkin=${filters.checkin}&checkout=${filters.checkout}${filters.guests ? `&guests=${filters.guests}` : ""}` : "";

  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi">
        <p className="text-eyebrow">Explore stays</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">
          Find a quiet place in nature.
        </h1>
        <div className="mt-8">
          <StaySearchBar q={filters.q} checkin={filters.checkin} checkout={filters.checkout} guests={filters.guests}
            hidden={{ category: filters.category, sort: filters.sort !== "featured" ? filters.sort : undefined }} />
        </div>

        {!outcome.configured ? (
          <div className="mt-12"><BackendNotice feature="Stay search" /></div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[17rem_1fr]">
            {/* ---------------- filters: collapsible on mobile, always open on desktop */}
            <aside>
              <details className="rounded-2xl border border-forest-900/10 bg-white lg:hidden" open={filterCount > 0}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-forest-950">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}
                </summary>
                <div className="border-t border-forest-900/10">
                  <StayFiltersForm filters={filters} catalog={catalog} idPrefix="m" hasAnyFilter={hasAnyFilter} />
                </div>
              </details>
              <div className="hidden rounded-2xl border border-forest-900/10 bg-white lg:block">
                <p className="flex items-center gap-2 border-b border-forest-900/10 px-5 py-3.5 text-sm font-medium text-forest-950">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}
                </p>
                <StayFiltersForm filters={filters} catalog={catalog} idPrefix="d" hasAnyFilter={hasAnyFilter} />
              </div>
            </aside>

            {/* ---------------- results */}
            <div>
              <p className="text-sm text-ink/60" aria-live="polite">
                {outcome.error ? "" : `${outcome.total} ${outcome.total === 1 ? "stay" : "stays"}${filters.q ? ` for “${filters.q}”` : ""}`}
              </p>
              {outcome.error ? (
                <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
                  We couldn&apos;t load stays right now. Please refresh in a moment.
                </div>
              ) : outcome.results.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-14 text-center">
                  <p className="font-display text-xl text-forest-950">{hasAnyFilter ? "No stays match those filters" : "No stays are live yet"}</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
                    {hasAnyFilter
                      ? "Try different dates, fewer filters, or a broader destination."
                      : "Property owners are being onboarded. Check back soon — or list your own property."}
                  </p>
                  <Link href={hasAnyFilter ? "/stays" : "/list-your-property"} className="mt-5 inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">
                    {hasAnyFilter ? "Clear all filters" : "List your property"}
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {outcome.results.map((s) => <StayCard key={s.id} stay={s} query={dateQuery} />)}
                  </div>
                  {totalPages > 1 ? (
                    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                      {filters.page > 1 ? (
                        <Link rel="prev" href={`/stays${stayFiltersToQuery({ ...filters, page: filters.page - 1 })}`} className="rounded-full border border-forest-900/20 px-5 py-2 text-sm hover:bg-forest-50">Previous</Link>
                      ) : null}
                      <span className="text-sm text-ink/60">Page {filters.page} of {totalPages}</span>
                      {filters.page < totalPages ? (
                        <Link rel="next" href={`/stays${stayFiltersToQuery({ ...filters, page: filters.page + 1 })}`} className="rounded-full border border-forest-900/20 px-5 py-2 text-sm hover:bg-forest-50">Next</Link>
                      ) : null}
                    </nav>
                  ) : null}
                </>
              )}
              {outcome.results.some((r) => r.is_sample) ? (
                <p className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  Listings marked <strong>Sample listing</strong> are demonstration data, not real properties. They will be replaced as owners list genuine stays.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
