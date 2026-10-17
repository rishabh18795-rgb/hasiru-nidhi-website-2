export default function Loading() {
  return (
    <section className="bg-cream pb-24 pt-32" aria-busy="true" aria-label="Loading stays">
      <div className="container-nidhi">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-forest-900/10" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/10">
              <div className="aspect-[4/3] animate-pulse bg-forest-900/10" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-24 animate-pulse rounded bg-forest-900/10" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-forest-900/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-forest-900/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
