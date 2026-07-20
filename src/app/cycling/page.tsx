import Image from "next/image";
import type { Metadata } from "next";
import { Bike, Clock, Gauge, MapPinned } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Cycling",
  description:
    "Guided cycling trails through working farmland at Hasiru Nidhi, near Bengaluru — paced for scenery, not speed.",
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

export default function CyclingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 02 — Ride"
        title="Quiet roads, working farmland."
        description="Our cycling trail was never built for speed. It's a route chosen for what you notice at ten kilometres an hour — a heron at the pond, a farmer transplanting rice, the particular gold of morning light over the fields."
        image={images.cyclistSoloHill}
        crumb="Cycling"
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

      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="How It Works"
              title="No spandex required."
              description="Bicycles, helmets and water bottles are provided at no extra cost — just bring closed shoes. Rides are self-paced and unguided during the day, with an optional guided sunrise ride available on request for overnight guests."
            />
          </div>
          <Reveal delay={0.1} className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image
              src={images.bicycleDetail}
              alt="A bicycle ready for the trail at Hasiru Nidhi"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Bring your own bike, or use ours."
        description="Cycling is included in every Day Escape and overnight package — no separate booking needed."
      />
    </>
  );
}
