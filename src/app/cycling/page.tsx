import Image from "next/image";
import type { Metadata } from "next";
import { Bike, Clock, Gauge, MapPinned, Shirt, Users } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Cycling",
  description:
    "Guided cycling trails through lush Karnataka countryside at Hasiru Nidhi, near Bengaluru — paced for scenery, not speed.",
  alternates: { canonical: `${basePath}/cycling/` },
};

const stats = [
  { icon: MapPinned, label: "Route Length", value: "8 km loop" },
  { icon: Clock, label: "Duration", value: "45–60 min" },
  { icon: Gauge, label: "Difficulty", value: "Easy, gentle grades" },
  { icon: Bike, label: "Bikes", value: "Provided, all sizes" },
];

const routes = [
  {
    name: "The Farmland Loop",
    time: "Sunrise or late afternoon",
    copy: "Our signature ride — a flat, easy loop past paddy fields, the pond and the boundary tree line. Suitable for first-time riders and children over ten.",
    image: images.cyclistSoloHill,
  },
  {
    name: "The Village Extension",
    time: "Seasonal, weather permitting",
    copy: "For guests who want more distance, this extends the loop through the neighbouring village — a longer, slightly hillier ride best suited to confident riders.",
    image: images.cyclistsDuo,
  },
];

const practicalInfo = [
  {
    icon: Users,
    title: "Who It's For",
    copy: "First-time riders, families with children over ten, and anyone who'd rather notice the scenery than beat a personal best. No cycling experience needed.",
  },
  {
    icon: Shirt,
    title: "What to Bring",
    copy: "Comfortable closed shoes and a light layer for early starts. We provide the bicycle, helmet and water bottle — no gear needed from your end.",
  },
  {
    icon: Gauge,
    title: "Safety on the Trail",
    copy: "Helmets are compulsory and provided. Rides stay on the marked farm trail at a leisurely pace; our team briefs every rider before they set off.",
  },
];

export default function CyclingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 02 — Ride"
        title="Ride slower. See more."
        description="Our cycling trail was never built for speed. It's a route chosen for what you notice at ten kilometres an hour — a heron at the pond, the tree-lined lanes, the particular gold of morning light over the fields."
        image={images.cyclistSoloHill}
        crumb="Cycling"
        primaryCta={{ label: "Book a Cycling Experience", href: "/book?experience=cycling" }}
        secondaryCta={{ label: "Ask About Cycling", href: "/contact" }}
      />

      <section className="bg-cream py-24">
        <div className="container-nidhi">
          <StaggerGroup className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {stats.map((stat) => (
              <StaggerItem key={stat.label}>
                <div className="rounded-2xl bg-forest-50 p-6 text-center">
                  <stat.icon className="mx-auto h-6 w-6 text-forest-600" />
                  <p className="mt-3 font-display text-lg text-forest-950">{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">{stat.label}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-sand-50 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="The Routes"
            title="Two rides, chosen by how far you want to go."
          />
          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {routes.map((route) => (
              <Reveal key={route.name}>
                <div className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-forest-900/8">
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={route.image}
                      alt={route.name}
                      fill
                      sizes="(min-width: 1024px) 45vw, 90vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-forest-600">
                      {route.time}
                    </p>
                    <h3 className="mt-2 font-display text-2xl text-forest-950">{route.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink/65">{route.copy}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-forest-950 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Good to Know"
            title="No spandex required."
            description="Rides are self-paced and unguided during the day, with an optional guided sunrise ride available on request for overnight guests."
            tone="light"
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-3">
            {practicalInfo.map((item) => (
              <StaggerItem key={item.title}>
                <div className="h-full rounded-2xl bg-cream/5 p-6 ring-1 ring-cream/10">
                  <item.icon className="h-6 w-6 text-sand-300" />
                  <h3 className="mt-4 font-display text-lg text-cream">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/60">{item.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Bring Your Own, or Use Ours"
              title="Cycling is part of every stay, not an add-on."
              description="Whether you're here for a Day Escape or a full weekend, the trail and the bicycles are included at no extra cost — no separate booking needed once you've planned your visit."
            />
          </div>
          <Reveal delay={0.1} className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image
              src={images.bicycleDetail}
              alt="A quiet countryside road on the Hasiru Nidhi cycling trail"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Ready to ride?"
        description="Tell us your dates and how many are coming — cycling is included in every visit we plan."
        primaryLabel="Book a Cycling Experience"
        primaryHref="/book?experience=cycling"
        secondaryLabel="Ask About Cycling"
        secondaryHref="/contact"
      />
    </>
  );
}
