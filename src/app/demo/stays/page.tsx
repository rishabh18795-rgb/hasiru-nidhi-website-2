import Link from "next/link";
import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";

import { DemoModeBanner } from "@/components/stays/demo-mode";
import { StayCard } from "@/components/stays/stay-card";
import { StayFiltersForm } from "@/components/stays/filters-form";
import { StaySearchBar } from "@/components/stays/search-bar";
import { demoCatalog, searchDemo } from "@/lib/demo/properties";
import { PAGE_SIZE, activeFilterCount, parseStayFilters, stayFiltersToQuery, todayIST } from "@/lib/stays/filters";

export const metadata: Metadata = {
  title: "Demo mode — Explore Stays",
  description: "Six fictional demonstration listings for testing the Hasiru Nidhi marketplace interface. Not real properties.",
  robots: { index: false, follow: false },
};

/**
 * DEMO MODE. Six fictional listings built into the site (the same ones supabase/seed.sql loads into a test database). It never
 * touches the database, never replaces a failed live request, and every page says so. Nothing here can be booked or saved.
 */
export default async function DemoStaysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseStayFilters(await searchParams);
  const today = todayIST();
  const { results, total } = searchDemo(filters, today);
  const catalog = demoCatalog();
  const filterCount = activeFilterCount(filters);
  const hasAnyFilter = Boolean(filters.q) || filterCount > 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selection = { checkin: filters.checkin, checkout: filters.checkout, guests: filters.guests };
  const action = "/demo/stays";

  return (
    <>
      <div className="pt-20"><DemoModeBanner /></div>
      <section className="bg-cream pb-24 pt-10">
        <div className="container-nidhi">
          <p className="text-eyebrow">Explore stays · demo</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">Six demonstration stays</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink/65">Every listing here is fictional demonstration data — names, places, prices, photographs and availability are illustrative.</p>
          <div className="mt-8">
            <StaySearchBar action={action} q={filters.q} checkin={filters.checkin} checkout={filters.checkout} guests={filters.guests}
              hidden={{ category: filters.category, sort: filters.sort !== "featured" ? filters.sort : undefined }} />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[17rem_1fr]">
            <aside>
              <details className="rounded-2xl border border-forest-900/10 bg-white lg:hidden" open={filterCount > 0}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-forest-950">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}
                </summary>
                <div className="border-t border-forest-900/10"><StayFiltersForm action={action} filters={filters} catalog={catalog} idPrefix="m" hasAnyFilter={hasAnyFilter} /></div>
              </details>
              <div className="hidden rounded-2xl border border-forest-900/10 bg-white lg:block">
                <p className="flex items-center gap-2 border-b border-forest-900/10 px-5 py-3.5 text-sm font-medium text-forest-950">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}
                </p>
                <StayFiltersForm action={action} filters={filters} catalog={catalog} idPrefix="d" hasAnyFilter={hasAnyFilter} />
              </div>
            </aside>

            <div>
              <p className="text-sm text-ink/60" aria-live="polite" data-testid="demo-result-count">{total} {total === 1 ? "demo stay" : "demo stays"}{filters.q ? ` for “${filters.q}”` : ""}</p>
              {results.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-14 text-center">
                  <p className="font-display text-xl text-forest-950">No demo stays match those filters</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">Try different dates, fewer filters, or a broader destination.</p>
                  <Link href={action} className="mt-5 inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Clear all filters</Link>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {results.map((s) => <StayCard key={s.id} stay={s} base="/demo/stays" selection={selection} />)}
                  </div>
                  {totalPages > 1 ? (
                    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                      {filters.page > 1 ? <Link href={`${action}${stayFiltersToQuery({ ...filters, page: filters.page - 1 })}`} className="rounded-full border border-forest-900/20 px-5 py-2 text-sm hover:bg-forest-50">Previous</Link> : null}
                      <span className="text-sm text-ink/60">Page {filters.page} of {totalPages}</span>
                      {filters.page < totalPages ? <Link href={`${action}${stayFiltersToQuery({ ...filters, page: filters.page + 1 })}`} className="rounded-full border border-forest-900/20 px-5 py-2 text-sm hover:bg-forest-50">Next</Link> : null}
                    </nav>
                  ) : null}
                </>
              )}
              <p className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Listings marked <strong>DEMO LISTING — SAMPLE DATA</strong> are fictional. To test real accounts and booking requests, connect the database and use <Link href="/stays" className="underline">live Explore Stays</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
