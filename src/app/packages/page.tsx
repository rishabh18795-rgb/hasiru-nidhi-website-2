import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { images, packages } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Packages: farm days, nights and weekend ideas",
  description: "Ideas for a day, a night or a weekend at the Hasiru Nidhi farm. Packages are arranged by enquiry, with details confirmed by our team.",
  alternates: { canonical: `${basePath}/packages` },
};

export default function PackagesPage() {
  return (
    <>
      <PageHero
        eyebrow="Packages"
        title="Ideas for a day, a night or a weekend."
        description="Starting points for a visit to our farm. Tell us what you have in mind and we will shape it around your group."
        image={images.farmhouseCottage}
        crumb="Packages"
        primaryCta={{ label: "Send an enquiry", href: "/book" }}
        secondaryCta={{ label: "Explore available stays", href: "/stays" }}
      />

      <section className="bg-cream py-24" aria-labelledby="pkg-heading">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="How packages work"
            title="Enquire first. We confirm the details."
            description="These are ideas, not fixed products you can buy online. Inclusions, timings, prices and availability are confirmed by our team when you enquire, and nothing is booked or charged until you hear back from us."
          />
          <h2 id="pkg-heading" className="sr-only">Package ideas</h2>
          <StaggerGroup className="mt-14 grid gap-6 md:grid-cols-2">
            {packages.map((p) => (
              <StaggerItem key={p.slug}>
                <article className={`flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ${p.featured ? "ring-2 ring-forest-700" : "ring-forest-900/8"}`}>
                  <div className="relative aspect-[16/9]">
                    <Image src={p.image} alt="" fill sizes="(min-width: 768px) 45vw, 92vw" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <p className="text-xs font-medium uppercase tracking-wider text-forest-600">Best for {p.bestFor}</p>
                    <h3 className="mt-2 font-display text-2xl text-forest-950">{p.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">{p.description}</p>
                    <LinkButton href={`/book?package=${p.slug}`} className="mt-6 self-start rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700">
                      Enquire about this <ArrowUpRight className="h-4 w-4" />
                    </LinkButton>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-forest-50 py-20">
        <div className="container-nidhi grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
            <h2 className="font-display text-2xl text-forest-950">Want a stay at another property?</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/70">Marketplace stays are not packages. Each listing shows its own price breakdown for your dates. See <Link href="/pricing" className="underline">how pricing works</Link>.</p>
            <LinkButton href="/stays" className="mt-5 rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700">Explore available stays</LinkButton>
          </div>
          <div className="rounded-3xl bg-forest-900 p-8 text-cream">
            <h2 className="font-display text-2xl">Gardening help is separate</h2>
            <p className="mt-3 text-base leading-relaxed text-cream/80">Services for your own garden have their own enquiry and are not part of any package.</p>
            <LinkButton href="/gardening#enquire" className="mt-5 rounded-full bg-sand-400 px-6 text-forest-950 hover:bg-sand-300">Gardening enquiry</LinkButton>
          </div>
        </div>
      </section>

      <CtaBand
        title="Tell us what you have in mind."
        description="Share your dates, group size and ideas. Our team replies to confirm what is possible."
        primaryLabel="Send an enquiry"
        primaryHref="/book"
        secondaryLabel="Contact us"
        secondaryHref="/contact"
      />
    </>
  );
}
