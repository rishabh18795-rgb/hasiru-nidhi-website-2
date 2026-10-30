"use client";

import Link from "next/link";

/** Unexpected failure while rendering Explore Stays: say so plainly, offer a retry, never show made-up listings. */
export default function StaysError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi max-w-2xl">
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p className="font-display text-xl text-red-900">Something went wrong loading stays</p>
          <p className="mt-2">Please try again. If it keeps happening, the database may be unavailable. No listings are shown in its place.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="inline-flex h-10 items-center rounded-full bg-red-800 px-5 font-medium text-white hover:bg-red-900">Retry</button>
            <Link href="/demo/stays" className="inline-flex h-10 items-center rounded-full border border-red-300 bg-white px-5 font-medium text-red-900 hover:bg-red-50">Preview the demo listings (demo mode)</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
