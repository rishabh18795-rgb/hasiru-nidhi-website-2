import Image from "next/image";
import type { Metadata } from "next";
import { Compass, Droplets, Ruler, Trees } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "Landscaping",
  description:
    "The land design philosophy behind Hasiru Nidhi's grounds, and a look ahead at our upcoming landscaping studio for private gardens near Bengaluru.",
  alternates: { canonical: "/landscaping" },
};

const principles = [
  {
    icon: Compass,
    title: "Read the Land First",
    copy: "Every path and planting bed followed an existing contour or drainage line before we added anything new. We design with the site, not over it.",
  },
  {
    icon: Trees,
    title: "Native & Adapted Planting",
    copy: "Species chosen for what already thrives in this soil and climate — less irrigation, less intervention, and a garden that looks like it belongs here.",
  },
  {
    icon: Droplets,
    title: "Water-Wise by Default",
    copy: "Rain-fed where possible, drip-irrigated where not. Our pond and swales exist to hold water on the land rather than move it off as fast as possible.",
  },
  {
    icon: Ruler,
    title: "Built to Mature",
    copy: "We plant for the garden a design will become in five years, not the one that photographs best on day one.",
  },
];

export default function LandscapingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 04 — Design"
        title="Land shaped with restraint."
        description="The grounds at Hasiru Nidhi weren't landscaped so much as gradually revealed — native planting, stone paths, and water-wise design that lets the site do most of the talking."
        image={images.rosePathway}
        crumb="Landscaping"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Our Approach"
            title="Four principles behind every path and planting bed."
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2">
            {principles.map((principle) => (
              <StaggerItem key={principle.title}>
                <div className="flex gap-4 rounded-2xl bg-sand-50 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-earth-700 text-cream">
                    <principle.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg text-forest-950">{principle.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{principle.copy}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-forest-950 py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Coming Soon"
              title="A landscaping studio, beyond our own gate."
              description="After years of shaping our own twelve acres, we're opening a landscaping design practice for private gardens, farms and campuses — bringing the same land-first philosophy to sites beyond Hasiru Nidhi."
              tone="light"
            />
          </div>
          <Reveal delay={0.1} className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image
              src={images.cropRowsAerial}
              alt="Aerial view of planted rows on the Hasiru Nidhi grounds"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <section className="bg-sand-50 py-28">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Walk the Grounds" title="See the design in person." align="center" className="mx-auto" />
          <Reveal className="relative mt-14 aspect-[21/9] overflow-hidden rounded-[2.5rem]">
            <Image
              src={images.rosePathway}
              alt="A landscaped pathway through the Hasiru Nidhi gardens"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Curious about a project of your own?"
        description="Our landscaping studio is still taking shape — write to us and we'll keep you posted as it opens."
      />
    </>
  );
}
