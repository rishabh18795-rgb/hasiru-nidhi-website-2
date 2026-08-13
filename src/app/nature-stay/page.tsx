import Image from "next/image";
import type { Metadata } from "next";
import { Bike, Flame, Sprout, Sunrise, Users } from "lucide-react";

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
    slug: "farmhouse-room",
    description:
      "Our original stay — four rooms inside the main farmhouse, each with a private verandah facing the fields. Simple, quiet, and close to the kitchen and bonfire circle.",
    image: images.farmhouseCottage,
    occupancy: "2 adults + 1 child",
    privacy: "Shared farmhouse building, private room",
    details: ["Twin or double bed", "Attached bath, hot water", "Verandah seating", "Fan-cooled, ceiling height for airflow"],
  },
  {
    name: "Cottage",
    slug: "cottage",
    description:
      "Set slightly apart from the main house for guests who want more distance from the common areas — same natural materials, a touch more privacy.",
    image: images.cabinMisty,
    occupancy: "2 adults + 1 child",
    privacy: "Standalone, fully private",
    details: ["Double bed", "Attached bath, hot water", "Private sit-out", "Closer to the cycling trailhead"],
  },
];

const included = [
  { icon: Sunrise, title: "Full Farm Access", copy: "Gardens, trails, animals and grounds, open from check-in to check-out." },
  { icon: Sprout, title: "Garden Access", copy: "Walk the working kitchen garden any time, guided sessions included." },
  { icon: Bike, title: "Cycling Access", copy: "Bicycles and helmets provided for the farmland loop, no extra charge." },
  { icon: Flame, title: "Bonfire Evenings", copy: "Lit most nights, weather permitting — part of every overnight stay." },
  { icon: Users, title: "All Meals", copy: "Vegetarian, largely from our own beds, served at a shared table." },
];

export default function NatureStayPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar 01 — Stay"
        title="Wake up closer to the land."
        description="Rooms built into the landscape rather than on top of it — natural materials, deep shade, and views chosen over amenities."
        image={images.cabinMisty}
        crumb="Nature Stay"
        primaryCta={{ label: "Enquire About Your Stay", href: "/book?experience=nature-stay" }}
        secondaryCta={{ label: "View Stay Options", href: "#stay-options" }}
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="What the Stay Feels Like"
              title="Slow mornings, full days, quiet nights."
              description="A stay here moves between a handful of farmhouse rooms and standalone cottages, each opening onto the working grounds rather than a hallway. Days are loosely structured around the garden and the cycling trail; evenings settle around the bonfire once the light goes. Guests have full run of the farm for the length of their stay — the gardens, the animals, the paths between them — with nothing scheduled that doesn't need to be."
            />
          </div>
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem]">
            <Image
              src={images.cozyInterior}
              alt="A quiet farmhouse interior at Hasiru Nidhi"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <section id="stay-options" className="scroll-mt-24 bg-sand-50 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Where You'll Sleep"
            title="Two ways to stay, both close to the ground."
            description="Every room opens onto the farm rather than a corridor — the idea is to make it hard to forget where you are, even indoors."
          />
          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {rooms.map((room) => (
              <Reveal key={room.name}>
                <div className="flex h-full flex-col overflow-hidden rounded-[2rem] bg-white ring-1 ring-forest-900/8">
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={room.image}
                      alt={room.name}
                      fill
                      sizes="(min-width: 1024px) 45vw, 90vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-8">
                    <h3 className="font-display text-2xl text-forest-950">{room.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink/65">{room.description}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-ink/55">
                      <div>
                        <dt className="uppercase tracking-wide">Occupancy</dt>
                        <dd className="mt-0.5 text-sm text-ink/75">{room.occupancy}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Privacy</dt>
                        <dd className="mt-0.5 text-sm text-ink/75">{room.privacy}</dd>
                      </div>
                    </dl>
                    <ul className="mt-5 grid grid-cols-2 gap-2 text-sm text-ink/60">
                      {room.details.map((detail) => (
                        <li key={detail} className="flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-forest-500" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                    <LinkButton
                      href={`/book?experience=nature-stay&stay=${room.slug}`}
                      size="lg"
                      className="mt-7 w-fit rounded-full bg-forest-800 text-cream hover:bg-forest-700"
                    >
                      Enquire About This Stay
                    </LinkButton>
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
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {included.map((item) => (
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
        title="Ready to slow down?"
        description="Share your preferred dates and group size — we'll confirm availability within 24 hours."
        primaryLabel="Plan Your Stay"
        primaryHref="/book?experience=nature-stay"
        secondaryLabel="Talk to Us"
        secondaryHref="/contact"
      />
    </>
  );
}
