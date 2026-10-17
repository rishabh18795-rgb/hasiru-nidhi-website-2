import type { Metadata } from "next";
import { Building2, Flower2, Home, Leaf, Sprout, Sun, TreePine, Wrench } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { GardeningQuoteForm } from "@/components/site/gardening-quote-form";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "Gardening & landscaping services",
  description:
    "Garden design, lawns, plants, balcony and terrace gardens, vertical gardens, pots and décor, and ongoing plant care for homes, villas, resorts and commercial spaces. Request a quote.",
  alternates: { canonical: "/gardening-landscaping" },
};

const services = [
  { icon: Sprout, title: "Garden design & development", copy: "Layouts built around your light, soil, space and how you actually use the garden." },
  { icon: Leaf, title: "Lawn installation & maintenance", copy: "Natural-grass lawns, preparation and regular upkeep." },
  { icon: Flower2, title: "Indoor & outdoor plants", copy: "Foliage, flowering and shade plants suited to Karnataka's climate." },
  { icon: TreePine, title: "Ornamental & premium plants", copy: "Statement trees, palms and specimen plants for entrances and focal points." },
  { icon: Home, title: "Balcony & terrace gardening", copy: "Compact, low-weight planting schemes for apartments and rooftops." },
  { icon: Sun, title: "Vertical gardens & green walls", copy: "Living walls for courtyards, boundaries and indoor feature walls." },
  { icon: Wrench, title: "Pots, planters & garden décor", copy: "Containers, stones, lighting and finishing touches." },
  { icon: Sprout, title: "Plant care & maintenance", copy: "Scheduled visits for pruning, feeding, pest care and replacements." },
];

const segments = ["Independent homes", "Villas & gated communities", "Apartments (balcony / terrace)", "Resorts & hospitality", "Offices & commercial spaces"];

export default function GardeningLandscapingPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Gardens designed to be lived in."
        description="From a balcony of herbs to a resort landscape — tell us about your space and we'll come back with a plan and a quote."
        image={images.rosePathway}
        crumb="Gardening & Landscaping"
        primaryCta={{ label: "Request a quote", href: "#quote" }}
      />

      <section className="bg-cream py-24">
        <div className="container-nidhi">
          <SectionHeading eyebrow="What we do" title="Everything from design to day-to-day care." />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <StaggerItem key={s.title}>
                <div className="h-full rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-cream"><s.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 font-display text-lg text-forest-950">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">{s.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-sand-50 py-20">
        <div className="container-nidhi grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading eyebrow="Who it's for" title="Residential, villa, resort and commercial." description="Whatever the scale, the process is the same: understand the space, agree a plan, then build and maintain it." />
          <Reveal>
            <ul className="flex flex-wrap gap-3">
              {segments.map((s) => <li key={s} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-forest-900 ring-1 ring-forest-900/10"><Building2 className="h-4 w-4 text-forest-600" aria-hidden="true" />{s}</li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      <section id="quote" className="scroll-mt-24 bg-cream py-24">
        <div className="container-nidhi grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading eyebrow="Get a quote" title="Tell us about your space." description="Share a few details and, if you can, photos. A member of our team will review them and get back to you with next steps. The quote is an estimate and is confirmed after we understand the site." />
            <Reveal className="mt-8"><WhatsAppButton topic="gardening" label="Discuss on WhatsApp" /></Reveal>
          </div>
          <Reveal className="rounded-[2rem] bg-white p-8 ring-1 ring-forest-900/8 sm:p-10"><GardeningQuoteForm /></Reveal>
        </div>
      </section>
    </>
  );
}
