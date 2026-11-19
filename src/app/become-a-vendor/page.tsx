import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { LinkButton } from "@/components/site/link-button";
import { SectionHeading } from "@/components/site/section-heading";
import { getMarketplaceFlags } from "@/lib/flags";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Become a vendor: sell, serve or host on Hasiru Nidhi",
  description: "Apply to sell products, offer services or host nature stays on Hasiru Nidhi. Each is verified and approved separately.",
  alternates: { canonical: `${basePath}/become-a-vendor` },
  robots: { index: false, follow: true },
};

// Reads the public feature flag, so it is rendered per request and reflects an administrator's switch immediately.
export const dynamic = "force-dynamic";

const STEPS = [
  ["Apply", "Tell us about your business, and upload any documents we ask for."],
  ["Get verified", "Our team reviews your business. Each thing you want to do, selling products, offering services or hosting stays, is approved separately."],
  ["List and manage", "Create listings from your vendor dashboard. Every listing is reviewed by our team before it goes live."],
];

export default async function BecomeAVendorPage() {
  const flags = await getMarketplaceFlags();
  return (
    <>
      <PageHero
        eyebrow="Vendors"
        title="Grow with Hasiru Nidhi."
        description="One account for everything you do with us: selling products, offering services and hosting nature stays."
        image={images.farmhouseCottage}
        crumb="Become a vendor"
        primaryCta={flags.vendorRegistration ? { label: "Start your application", href: "/vendor/profile" } : undefined}
        secondaryCta={{ label: "Host a nature stay", href: "/become-a-host" }}
      />
      <section className="bg-cream py-20">
        <div className="container-nidhi max-w-4xl">
          {!flags.vendorRegistration ? (
            <div className="mb-14 rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
              <h2 className="font-display text-2xl text-forest-950">Vendor registration is not open yet</h2>
              <p className="mt-2 text-base leading-relaxed text-ink/70">We are preparing the marketplace and are not accepting vendor applications today. If you own a property in nature, you can already <a className="underline" href="/become-a-host">become a host</a>. For anything else, <a className="underline" href="/contact">contact us</a>.</p>
            </div>
          ) : null}
          <SectionHeading eyebrow="How it will work" title="Verified first, listed second." />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([t, c], i) => (
              <li key={t} className="rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                <span className="font-display text-4xl text-sand-500">{i + 1}</span>
                <h3 className="mt-2 font-display text-xl text-forest-950">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{c}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-ink/60">Verification does not guarantee approval or sales. Payment collection, commissions, taxes and shipping rules are confirmed with vendors before any listing goes live.</p>
          {flags.vendorRegistration ? <div className="mt-8"><LinkButton href="/vendor/profile" size="lg" className="rounded-full bg-forest-800 px-7 text-cream hover:bg-forest-700">Start your application</LinkButton></div> : null}
        </div>
      </section>
    </>
  );
}
