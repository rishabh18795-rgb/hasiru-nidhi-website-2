"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Shown on the gardening page only while an administrator has switched Services ON. The gardening enquiry form below it is unchanged:
 * this is an additional way to reach a provider, never a replacement. Read in the browser so the page itself stays static.
 */
export function ServicesPromo() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    void supabase.from("platform_settings").select("value").eq("key", "marketplace_services_enabled").maybeSingle().then(({ data }) => { if (!cancelled) setOpen(data?.value === true); });
    return () => { cancelled = true; };
  }, []);
  if (!open) return null;
  return (
    <section className="bg-forest-50 py-10" aria-label="Book a verified gardening provider">
      <div className="container-nidhi flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-display text-xl text-forest-950">Prefer to book a verified gardener directly?</p>
          <p className="mt-1 text-sm text-ink/70">Browse providers who list their own prices, or ask one for a quotation. Or use the enquiry form below, which works exactly as before.</p>
        </div>
        <Link href="/services" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">Browse gardening services <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
