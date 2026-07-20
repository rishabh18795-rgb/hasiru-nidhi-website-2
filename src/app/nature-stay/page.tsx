import Image from "next/image";
import type { Metadata } from "next";
import { Flame, Moon, Sunrise, Wind } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { LinkButton } from "@/components/site/link-button";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Nature Stay",
  description:
    "Farmhouse rooms and open-air cottages at Hasiru Nidhi, built into the landscape near Bengaluru — deep verandahs, natural materials, and a full working farm at your doorstep.",
  alternates: { canonical: `${basePath}/nature-stay/` },
};

const rooms = [
  {
    name: "Farmhouse Room",
    description:
      "Our original stay — four rooms inside the main farmhouse, each with a private verandah facing the fields. Simple, quiet, and close to the kitchen and bonfire circle.",
    image: images.farmhouseCottage,
    details: ["Twin or double bed", "Attached bath, hot water", "Verandah seating", "Fan-cooled, ceiling height for airflow"],
  },
  {
    name: "Cottage",
    description:
      "Set slightly apart from the main house for guests who want more distance from the common areas — same natural materials, a touch more privacy.",
    image: images.cabinMisty,
    details: ["Double bed", "Attached bath, hot water", "Private sit-out", "Closer to the cycling trailhead"],
  },
];

const included = [
  { icon: Sunrise, title: "Full Farm Access", copy: "Gardens, trails, animals and grounds, open from check-in to check-out." },
  { icon: Flame, title: "Bonfire Evenings", copy: "Lit most nights, weather permitting — part of every overnight stay." },
  { icon: Wind, title: "All Meals", copy: "Vegetarian, largely from our own beds, served at a shared table." },
  { icon: Moon, title: "Genuinely Quiet Nights", copy: "No amplified music after dinner. Just the farm, settling in." },
];

export default function NatureStayPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 01 — Stay"
        title="Wake up to birdsong, not traffic."
        description="Rooms built into the landscape rather than on top of it — natural materials, deep shade, and views chosen over amenities."
        image={images.cabinMisty}
        crumb="Nature Stay"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Where You'll Sleep"
            title="Two ways to stay, both close to the ground."
            description="Every room opens onto the farm rather than a corridor — the idea is to make it hard to forget where you are, even indoors."
          />
          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {rooms.map((room) => (
              <Reveal key={room.name}>
                <div className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-forest-900/8">
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={room.image}
                      alt={room.name}
                      fill
                      sizes="(min-width: 1024px) 45vw, 90vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-8">
                    <h3 className="font-display text-2xl text-forest-950">{room.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink/65">{room.description}</p>
                    <ul className="mt-5 grid grid-cols-2 gap-2 text-sm text-ink/60">
                      {room.details.map((detail) => (
                        <li key={detail} className="flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-forest-500" />
                          {detail}
                        </li>
                      ))}
                    </ul>
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
            eyebrow="What's Included"
            title="Everything you need, nothing you don't."
            tone="light"
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {included.map((item) => (
              <StaggerItem key={item.title}>
                <div className="rounded-2xl bg-cream/5 p-6 ring-1 ring-cream/10">
                  <item.icon className="h-6 w-6 text-sand-300" />
                  <h3 className="mt-4 font-display text-lg text-cream">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/60">{item.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-sand-50 py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem]">
            <Image
              src={images.campingTentDusk}
              alt="Evening at the Hasiru Nidhi campsite"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="After Dark"
              title="The farm doesn't stop being beautiful at night."
              description="Once the sky clears of city glow, guests are often surprised by how much of it shows up overhead. We keep a few telescopes on hand during peak season, and point out what we can on clear nights by the fire."
            />
            <Reveal delay={0.15} className="mt-8">
              <LinkButton href="/packages" size="lg" className="rounded-full bg-forest-800 px-7 text-cream hover:bg-forest-700">
                View Stay Packages
              </LinkButton>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand
        title="Ready to book your stay?"
        description="Share your preferred dates and group size — we'll confirm availability within 24 hours."
      />
    </>
  );
}
