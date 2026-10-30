import Link from "next/link";
import { FlaskConical } from "lucide-react";

/** Pointer to the built-in demo mode, shown only where the live database is unavailable. */
export function DemoModeLink() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-medium"><FlaskConical className="h-4 w-4" aria-hidden="true" /> Want to see how it will look?</p>
      <p className="mt-1">Demo mode shows six fictional listings built into the site so you can try browsing, filters, detail pages and price calculation. It does not use the database and nothing you do there is saved.</p>
      <Link href="/demo/stays" className="mt-3 inline-flex h-10 items-center rounded-full bg-amber-900 px-5 font-medium text-white hover:bg-amber-950">Open demo mode</Link>
    </div>
  );
}

/** Always-visible banner on every demo-mode page so it can never be mistaken for the live marketplace. */
export function DemoModeBanner() {
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-100 text-amber-950" data-testid="demo-mode-banner">
      <div className="container-nidhi flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
        <strong className="uppercase tracking-wide">Demo mode</strong>
        <span>Built-in fictional listings. Not connected to the database; nothing here is saved, booked or real.</span>
        <Link href="/stays" className="ml-auto underline underline-offset-2">Go to live Explore Stays</Link>
      </div>
    </div>
  );
}
