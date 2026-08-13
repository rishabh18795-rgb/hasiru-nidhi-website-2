import Image from "next/image";
import type { Metadata } from "next";
import {
  Compass,
  Droplets,
  Footprints,
  Ruler,
  Sprout,
  Trees,
  Wrench,
} from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Landscaping",
  description:
    "Nature-led landscaping and land design from the team behind Hasiru Nidhi's own grounds — native planting, water-conscious design and land planning near Bengaluru.",
  alternates: { canonical: `${basePath}/landscaping/` },
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

const services = [
  {
    icon: Sprout,
    title: "Native Planting",
    copy: "Species selection built around what already thrives in local soil and climate, reducing long-term water and maintenance needs.",
  },
  {
    icon: Compass,
    title: "Garden & Landscape Design",
    copy: "Full planning for new or existing grounds — from a single courtyard to multi-acre farmland, grounded in a site visit before anything is drawn.",
  },
  {
    icon: Droplets,
    title: "Water-Conscious Design",
    copy: "Swales, ponds and drainage planning that work with rainfall patterns rather than fighting them.",
  },
  {
    icon: Footprints,
    title: "Natural Pathways & Outdoor Spaces",
    copy: "Stone and packed-earth paths, seating areas and gathering spaces designed to age well with the planting around them.",
  },
  {
    icon: Wrench,
    title: "Maintenance & Planting Consultation",
    copy: "Ongoing advice for gardens already in the ground — what to prune, what to replace, and what to leave alone.",
  },
];

export default function LandscapingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 04 — Design"
        title="Land shaped with restraint."
        description="The grounds at Hasiru Nidhi weren't landscaped so much as gradually revealed — native planting, stone paths, and water-wise design that lets the site do most of the talking. We now bring the same practice to gardens beyond our own gate."
        image={images.rosePathway}
        crumb="Landscaping"
        primaryCta={{ label: "Discuss Your Landscape", href: "/book?experience=landscaping" }}
        secondaryCta={{ label: "View Our Approach", href: "#approach" }}
      />

      <section id="approach" className="scroll-mt-24 bg-cream py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Philosophy"
            title="Design that belongs to the land."
            description="Four principles behind every path and planting bed at Hasiru Nidhi — the same ones we bring to every outside project."
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
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Services"
            title="A professional practice, not a hotel amenity."
            description="Our landscaping studio works with private gardens, farms and campuses beyond Hasiru Nidhi — always starting with a site visit, never a catalogue."
            tone="light"
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <StaggerItem key={service.title}>
                <div className="h-full rounded-2xl bg-cream/5 p-6 ring-1 ring-cream/10">
                  <service.icon className="h-6 w-6 text-sand-300" />
                  <h3 className="mt-4 font-display text-lg text-cream">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/60">{service.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
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
        title="Have a project in mind?"
        description="Tell us about your site — its size, location and what you're hoping for — and we'll start with a conversation, not a quote."
        primaryLabel="Discuss Your Landscape"
        primaryHref="/book?experience=landscaping"
        secondaryLabel="Talk to Us"
        secondaryHref="/contact"
      />
    </>
  );
}
