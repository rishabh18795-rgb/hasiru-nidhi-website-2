import Image from "next/image";
import type { Metadata } from "next";
import { Calendar, ClipboardList, Droplets, Sprout } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "Gardening Services",
  description:
    "Hands-in-the-soil gardening experiences at Hasiru Nidhi, plus a preview of our upcoming plant store and nursery near Bengaluru.",
  alternates: { canonical: "/gardening" },
};

const activities = [
  {
    icon: Sprout,
    title: "Kitchen Garden Walkthrough",
    copy: "A guided walk through our working vegetable beds — what's in season, how we rotate crops, and why we've stayed away from synthetic inputs since day one.",
  },
  {
    icon: ClipboardList,
    title: "Hands-On Sessions",
    copy: "Roll up your sleeves for transplanting, mulching or harvesting, depending on the week. Genuinely useful farm work, not a staged demonstration.",
  },
  {
    icon: Droplets,
    title: "Composting & Soil Health",
    copy: "A look at how we build soil from kitchen and farm waste — the unglamorous practice that everything else here depends on.",
  },
  {
    icon: Calendar,
    title: "Seasonal Workshops",
    copy: "Periodic half-day workshops on topics like seed saving, container gardening and natural pest management, open to day visitors.",
  },
];

export default function GardeningPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 03 — Grow"
        title="Hands in the soil, season by season."
        description="Our kitchen garden isn't a backdrop — it feeds the table. Guests are welcome to walk it, work it, and take home whatever they learn."
        image={images.gardeningTools}
        crumb="Gardening Services"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="What You Can Join"
            title="From a short walkthrough to a full working session."
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2">
            {activities.map((activity) => (
              <StaggerItem key={activity.title}>
                <div className="flex gap-4 rounded-2xl bg-forest-50 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800 text-cream">
                    <activity.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg text-forest-950">{activity.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{activity.copy}</p>
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
              alt="Eucalyptus cutting from the Hasiru Nidhi nursery"
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
            { image: images.strawberryHarvest, caption: "Harvest day in the kitchen garden" },
            { image: images.seedTrays, caption: "Seed trays ahead of the monsoon planting" },
            { image: images.carrotsHarvest, caption: "Root vegetables, ready for the kitchen" },
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
        title="Come learn what the season is teaching us."
        description="Gardening walkthroughs are included in every stay, and available to day visitors on request."
      />
    </>
  );
}
