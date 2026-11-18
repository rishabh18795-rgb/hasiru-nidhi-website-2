"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

/** Shown inside a portal's shell while a page is loading. Matches the content width so the layout does not jump. */
export function PortalLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-forest-900/10" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-forest-900/8" />)}
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-forest-900/8" />
    </div>
  );
}

/**
 * Error boundary body for a portal. It says plainly that something failed (never an empty page or a fake success), offers a retry
 * and a way out, and logs the technical detail to the console only.
 */
export function PortalError({ error, reset, home, homeLabel }: { error: Error & { digest?: string }; reset: () => void; home: string; homeLabel: string }) {
  useEffect(() => {
    console.error("portal page failed", error.digest ?? "", error.message);
  }, [error]);
  return (
    <div role="alert" className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
      <p className="font-display text-xl">This page couldn&apos;t be loaded.</p>
      <p>Nothing has been changed. This is usually a temporary connection problem; please try again. If it keeps happening, contact support{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-full bg-red-800 px-5 font-medium text-white hover:bg-red-900">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
        <Link href={home} className="inline-flex h-10 items-center rounded-full border border-red-300 bg-white px-5 font-medium text-red-900 hover:bg-red-50">{homeLabel}</Link>
      </div>
    </div>
  );
}
