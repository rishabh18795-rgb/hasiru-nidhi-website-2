import Image from "next/image";
import type { Metadata } from "next";
import { Check } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { packages, images } from "@/lib/content";
import { cn } from "@/lib/utils";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Day escapes, farmhouse overnights, weekend retreats and corporate offsites at Hasiru Nidhi — nature experience packages near Bengaluru.",
  alternates: { canonical: `${basePath}/packages/` },
};

export default function PackagesPage() {
  return (
    <>
      <PageHero
        eyebrow="Packages"
        title="Choose how much time you'd like."
        description="From a single day to a full weekend, every package includes the full working farm — gardens, trails and animals — as standard."
        image={images.farmhouseCottage}
        crumb="Packages"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <div className="grid gap-8 lg:grid-cols-2">
            {packages.map((pkg) => (
              <Reveal key={pkg.slug}>
                <div
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-[2rem] bg-white ring-1 ring-forest-900/8",
                    pkg.featured && "ring-2 ring-forest-700"
                  )}
                >
                  <div className="relative aspect-[16/9]">
                    <Image
                      src={pkg.image}
                      alt={pkg.name}
                      fill
                      sizes="(min-width: 1024px) 45vw, 90vw"
                      className="object-cover"
                    />
                    {pkg.featured ? (
                      <span className="absolute left-5 top-5 rounded-full bg-sand-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-forest-950">
                        Most Booked
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-8">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-2xl text-forest-950">{pkg.name}</h3>
                      <span className="text-sm font-medium text-forest-600">{pkg.duration}</span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-ink/45">
                      Best for {pkg.bestFor}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-ink/65">{pkg.description}</p>
                    <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                      {pkg.inclusions.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-ink/70">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <LinkButton
                      href="/contact"
                      size="lg"
                      className="mt-7 rounded-full bg-forest-800 text-cream hover:bg-forest-700"
                    >
                      Enquire About This Package
                    </LinkButton>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Planning something custom?"
        description="Multi-day retreats, large groups and special occasions are all things we do regularly — just ask."
      />
    </>
  );
}
