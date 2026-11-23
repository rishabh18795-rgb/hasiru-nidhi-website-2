import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, SlidersHorizontal } from "lucide-react";

import { ServiceCard } from "@/components/services/service-card";
import { ServiceFiltersForm } from "@/components/services/service-filters";
import { ServicesNotOpen } from "@/components/services/service-notice";
import { getMarketplaceFlags } from "@/lib/flags";
import { getServiceCategories, searchServices } from "@/lib/data/services";
import { SERVICE_PAGE_SIZE, activeServiceFilterCount, parseServiceFilters, serviceFiltersToQuery } from "@/lib/services/filters";
import { cn } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const open = (await getMarketplaceFlags()).services;
  return {
    title: "Services: gardening and landscaping help",
    description: "Book verified gardening providers for fixed-price visits or ask for a quotation. Check that a provider serves your PIN code first.",
    alternates: { canonical: "/services" },
    robots: open ? undefined : { index: false, follow: true },
  };
}

// An administrator switching Services ON or OFF is reflected within seconds without a deploy.
export const revalidate = 15;

export default async function ServicesPage({ searchParams }: { searchParams: SP }) {
  if (!(await getMarketplaceFlags()).services) return <ServicesNotOpen />;
  const filters = parseServiceFilters(await searchParams);
  const [cats, outcome] = await Promise.all([getServiceCategories(), searchServices(filters)]);
  const base = "/services";
  const filterCount = activeServiceFilterCount(filters);
  const hasAnyFilter = Boolean(filters.q) || filterCount > 0 || Boolean(filters.category);
  const totalPages = Math.max(1, Math.ceil(outcome.total / SERVICE_PAGE_SIZE));
  const current = cats.find((c) => c.slug === filters.category);
  const title = filters.q ? `Results for “${filters.q}”` : current?.name ?? "Services";

  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink/60"><Link href="/" className="hover:underline">Home</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span aria-current="page" className="text-ink/80">Services</span></nav>
        <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">{current?.description ?? "Garden design, planting, lawn and plant care from verified providers. Some services have a fixed price you can request straight away; others are quoted after the provider hears the details. Nothing is charged online yet."}</p>

        <form action={base} method="get" role="search" aria-label="Search services" className="mt-6 grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-forest-900/10 sm:grid-cols-[1fr_12rem_auto]">
          <label className="sr-only" htmlFor="svc-q">Search services</label>
          <input id="svc-q" name="q" defaultValue={filters.q} placeholder="Search lawn care, garden design, planting…" className="h-12 rounded-2xl border border-forest-900/15 bg-white px-4 text-sm outline-none focus-visible:border-forest-500 focus-visible:ring-2 focus-visible:ring-forest-500/30" />
          <label className="sr-only" htmlFor="svc-pin">PIN code</label>
          <input id="svc-pin" name="pin" inputMode="numeric" maxLength={6} defaultValue={filters.pin} placeholder="Your PIN code" className="h-12 rounded-2xl border border-forest-900/15 bg-white px-4 text-sm outline-none focus-visible:border-forest-500 focus-visible:ring-2 focus-visible:ring-forest-500/30" />
          <button type="submit" className="inline-flex h-12 items-center justify-center rounded-full bg-forest-800 px-7 text-sm font-medium text-cream hover:bg-forest-700">Search</button>
        </form>

        {cats.length > 1 ? (
          <nav aria-label="Categories" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {[{ slug: "", name: "All" }, ...cats].map((c) => (
              <Link key={c.slug || "all"} href={`${base}${serviceFiltersToQuery({ ...filters, category: c.slug, page: 1 })}`} aria-current={c.slug === filters.category ? "page" : undefined}
                className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium", c.slug === filters.category ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{c.name}</Link>
            ))}
          </nav>
        ) : null}

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside>
            <details className="rounded-2xl border border-forest-900/10 bg-white lg:hidden" open={filterCount > 0}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-forest-950"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}</summary>
              <div className="border-t border-forest-900/10"><ServiceFiltersForm filters={filters} basePath={base} idPrefix="m" hasAnyFilter={hasAnyFilter} /></div>
            </details>
            <div className="hidden rounded-2xl border border-forest-900/10 bg-white lg:block">
              <p className="flex items-center gap-2 border-b border-forest-900/10 px-5 py-3.5 text-sm font-medium text-forest-950"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ""}</p>
              <ServiceFiltersForm filters={filters} basePath={base} idPrefix="d" hasAnyFilter={hasAnyFilter} />
            </div>
            <div className="mt-4 rounded-2xl border border-forest-900/10 bg-white p-5 text-sm">
              <p className="font-medium text-forest-950">Not sure what you need?</p>
              <p className="mt-1 text-ink/65">Send a general gardening enquiry to our team. It works exactly as before.</p>
              <Link href="/gardening#enquire" className="mt-3 inline-flex text-forest-700 underline">Gardening enquiry</Link>
            </div>
          </aside>

          <div>
            <p className="text-sm text-ink/60" aria-live="polite">{outcome.error ? "" : `${outcome.total} ${outcome.total === 1 ? "service" : "services"}${filters.pin ? ` available at ${filters.pin}` : ""}`}</p>
            {outcome.error ? (
              <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">We couldn&apos;t load services right now. Nothing is shown in its place. <a href={`${base}${serviceFiltersToQuery(filters)}`} className="underline">Retry</a></div>
            ) : outcome.results.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-14 text-center">
                <p className="font-display text-xl text-forest-950">{hasAnyFilter ? "No services match these filters" : "No services are listed yet"}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{hasAnyFilter ? "Try a different PIN code, clear the filters, or send a general gardening enquiry." : "Services appear here only after a verified provider lists them and our team approves them. We never show sample providers as if they were real."}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {hasAnyFilter ? <Link href={base} className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Clear all filters</Link> : <Link href="/become-a-vendor" className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Become a provider</Link>}
                  <Link href="/gardening#enquire" className="inline-flex h-10 items-center rounded-full border border-forest-900/20 px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">Gardening enquiry</Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">{outcome.results.map((s) => <ServiceCard key={s.id} service={s} />)}</div>
                {totalPages > 1 ? (
                  <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                    {filters.page > 1 ? <Link rel="prev" href={`${base}${serviceFiltersToQuery({ ...filters, page: filters.page - 1 })}`} className="rounded-full border border-forest-900/20 bg-white px-5 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">Previous</Link> : null}
                    <span className="text-sm text-ink/60">Page {filters.page} of {totalPages}</span>
                    {filters.page < totalPages ? <Link rel="next" href={`${base}${serviceFiltersToQuery({ ...filters, page: filters.page + 1 })}`} className="rounded-full border border-forest-900/20 bg-white px-5 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">Next</Link> : null}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
