import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Calendar, ClipboardList, Droplets, Flower2, Leaf, Sprout } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { GardeningQuoteForm } from "@/components/site/gardening-quote-form";
import { ServicesPromo } from "@/components/site/services-promo";
import { gardeningServices } from "@/lib/validation/enquiries";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Gardening Services",
  description:
    "Garden design, lawns, plants and ongoing care from the Hasiru Nidhi team — send a gardening enquiry. A service separate from nature-stay bookings.",
  alternates: { canonical: `${basePath}/gardening` },
};

const activities = [
  {
    icon: Sprout,
    title: "Kitchen Garden Walkthrough",
    copy: "A guided walk through our working vegetable beds — what's in season, how we rotate crops, and why we've stayed away from synthetic inputs since day one.",
    audience: "Everyone — no experience needed",
  },
  {
    icon: ClipboardList,
    title: "Hands-On Sessions",
    copy: "Join in on transplanting, mulching or harvesting, depending on the week — a genuine part of how the garden runs, not a staged demonstration.",
    audience: "Guests who want a closer, hands-on visit",
  },
  {
    icon: Droplets,
    title: "Composting & Soil Health",
    copy: "A look at how we build soil from kitchen and farm waste — the unglamorous practice that everything else here depends on.",
    audience: "Curious gardeners, aspiring growers",
  },
  {
    icon: Calendar,
    title: "Seasonal Workshops",
    copy: "Periodic half-day workshops on topics like seed saving, container gardening and natural pest management, open to day visitors.",
    audience: "Day visitors, by seasonal schedule",
  },
];

export default function GardeningPage() {
  return (
    <>
      <PageHero
        eyebrow="Gardening Services"
        title="Gardens designed, planted and cared for."
        description="Gardening is its own service at Hasiru Nidhi — separate from stay bookings. Tell us about your space and our team will come back to you with next steps."
        image={images.gardeningTools}
        crumb="Gardening Services"
        primaryCta={{ label: "Enquire Now", href: "#enquire" }}
        secondaryCta={{ label: "Garden design & landscaping", href: "/gardening-landscaping" }}
      />

      <section className="bg-forest-50 py-24" aria-labelledby="gardening-services-heading">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Our services"
            title="What we can help you with."
            description="Residential gardens, villas, terraces and commercial spaces. Share what you need and we will tell you what is possible."
          />
          <ul id="gardening-services-heading" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gardeningServices.map((service, i) => (
              <li key={service.value} className="flex items-start gap-3 rounded-2xl bg-white p-5 ring-1 ring-forest-900/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-800 text-cream">
                  {i % 3 === 0 ? <Leaf className="h-5 w-5" aria-hidden="true" /> : i % 3 === 1 ? <Flower2 className="h-5 w-5" aria-hidden="true" /> : <Sprout className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className="font-medium leading-snug text-forest-950">{service.label}</span>
              </li>
            ))}
          </ul>
          <ol className="mt-14 grid gap-6 sm:grid-cols-3" aria-label="How a gardening enquiry works">
            {[
              ["1", "Tell us about your space", "Share the location, type of property, the services you need and, if you can, photos."],
              ["2", "Our team reviews it", "A member of the Hasiru Nidhi gardening team reads your enquiry and photos."],
              ["3", "We get back to you", "We contact you with next steps. Any quote is an estimate, confirmed once we understand the site."],
            ].map(([n, title, copy]) => (
              <li key={n} className="rounded-2xl border border-forest-900/10 bg-cream p-6">
                <span className="font-display text-3xl text-sand-500">{n}</span>
                <h3 className="mt-2 font-display text-lg text-forest-950">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ServicesPromo />

      <section id="enquire" className="scroll-mt-24 bg-cream py-24">
        <div className="container-nidhi grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading
            eyebrow="Enquire now"
            title="Send a gardening enquiry."
            description="Your enquiry goes to our gardening team, separately from any property booking. We use your details only to respond. We do not charge anything at this stage."
          />
          <Reveal className="rounded-[2rem] bg-white p-8 ring-1 ring-forest-900/8 sm:p-10">
            <GardeningQuoteForm />
          </Reveal>
        </div>
      </section>

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Guest experiences at the farm"
            title="From a short walkthrough to a full working session."
            description="Separate from gardening services: these are activities guests can join at Hasiru Nidhi's own working garden."
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2">
            {activities.map((activity) => (
              <StaggerItem key={activity.title}>
                <div className="flex h-full flex-col gap-4 rounded-2xl bg-forest-50 p-6 sm:flex-row">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800 text-cream">
                    <activity.icon className="h-5 w-5" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <h3 className="font-display text-lg text-forest-950">{activity.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{activity.copy}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-forest-600">
                      {activity.audience}
                    </p>
                    <Link
                      href="/contact"
                      className="mt-auto inline-flex w-fit items-center gap-1 pt-3 text-sm font-medium text-forest-700 hover:text-forest-900"
                    >
                      Ask about this
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-forest-950 py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] lg:order-2">
            <Image
              src={images.eucalyptusBranch}
              alt="Marigold flowers in bloom in the Hasiru Nidhi garden"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
          <div className="lg:order-1">
            <SectionHeading
              eyebrow="Coming Soon"
              title="A plant store, growing out of the same beds."
              description="We're building a curated nursery counter at Hasiru Nidhi — native and low-maintenance species raised on-site, available to take home. It's a natural extension of a nursery that's already been feeding our own gardens for years."
              tone="light"
            />
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-28">
        <div className="container-nidhi grid gap-8 sm:grid-cols-3">
          {[
            { image: images.strawberryHarvest, caption: "An easy afternoon among the beds" },
            { image: images.seedTrays, caption: "Fresh from the garden that morning" },
            { image: images.carrotsHarvest, caption: "Vegetables, ready for the kitchen" },
          ].map((item) => (
            <Reveal key={item.caption} className="group overflow-hidden rounded-2xl">
              <div className="relative aspect-[4/5]">
                <Image
                  src={item.image}
                  alt={item.caption}
                  fill
                  sizes="(min-width: 640px) 33vw, 90vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-sm text-ink/60">{item.caption}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand
        title="Come grow with us."
        description="Need help with your own garden? Send an enquiry. Want to visit ours? Book a gardening experience."
        primaryLabel="Gardening enquiry"
        primaryHref="#enquire"
        secondaryLabel="Book a Gardening Experience"
        secondaryHref="/book?experience=gardening"
      />
    </>
  );
}
