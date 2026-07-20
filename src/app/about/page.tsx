import Image from "next/image";
import type { Metadata } from "next";
import { Leaf, Sprout, TreePine } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { StatRow } from "@/components/site/stat-row";
import { CtaBand } from "@/components/site/cta-band";
import { images, futureVentures } from "@/lib/content";
import { siteConfig } from "@/lib/site";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "The story behind Hasiru Nidhi — a working farm and nature experience retreat built around a simple idea: cultivate the land, and the memories follow.",
  alternates: { canonical: `${basePath}/about/` },
};

const ventureIcons = { Sprout, TreePine, Leaf };

const values = [
  {
    title: "Land First",
    copy: "Every decision starts with what the land can sustain, not what a brochure needs. The farm was working long before the first guest arrived, and it will keep working long after.",
  },
  {
    title: "Slow, On Purpose",
    copy: "We resist the urge to over-schedule. A good day here has room in it — for a longer breakfast, a wrong turn on the trail, a conversation that runs past its allotted hour.",
  },
  {
    title: "Honest Materials",
    copy: "Stone, wood and mud plaster over glass and steel wherever we can manage it. Nothing is built to look rustic — it simply is, because that's what the site asked for.",
  },
  {
    title: "Open Doors",
    copy: "The kitchen garden, the compost yard, the nursery beds — none of it is staged for visits. Guests see the farm as it actually runs, including on its less photogenic days.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Hasiru Nidhi"
        title="Cultivating nature, one season at a time."
        description="We are a working farm first, and a place to stay second — built on the belief that the best hospitality is simply good land, well kept."
        image={images.mistyHills}
        crumb="About"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="How We Started"
              title="A patch of land, and a stubborn question."
              description="Hasiru Nidhi Horizons began with twelve acres off Kanakapura Road and a question the founders couldn't put down: what would it feel like to build a place around nature's pace instead of the city's? Not a resort with a garden attached, but a working farm that happens to welcome guests — where the cycling trail exists because it's a good route through real farmland, and the kitchen serves what the beds produced that week, not what a supplier delivered."
            />
            <Reveal delay={0.15}>
              <p className="mt-6 text-lg leading-relaxed text-ink/70">
                The name carries the intent: Hasiru Nidhi translates roughly
                to &ldquo;green treasure&rdquo; in Kannada. Everything since —
                the gardens, the nursery beds, the farmhouse rooms, the
                cycling trail — has been built to earn that name rather than
                just wear it.
              </p>
            </Reveal>
          </div>
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem]">
            <Image
              src={images.forestLightBeam}
              alt="Morning light through the forest at Hasiru Nidhi"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <section className="bg-forest-950 py-24">
        <div className="container-nidhi">
          <StatRow tone="light" />
        </div>
      </section>

      <section className="bg-sand-50 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="What We Hold To"
            title="Four ideas that shape every decision here."
            align="center"
            className="mx-auto"
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <StaggerItem key={value.title}>
                <div className="h-full rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
                  <h3 className="font-display text-xl text-forest-950">{value.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/65">{value.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="order-2 grid grid-cols-2 gap-4 lg:order-1">
            <Reveal className="relative aspect-[3/4] overflow-hidden rounded-[2rem]">
              <Image
                src={images.seedlingsPots}
                alt="Seedlings ready for planting in the nursery beds"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
            <Reveal delay={0.12} className="relative mt-10 aspect-[3/4] overflow-hidden rounded-[2rem]">
              <Image
                src={images.rosePathway}
                alt="A pathway through the landscaped gardens"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="The Road Ahead"
              title="This is the first chapter, not the whole book."
              description="Hasiru Nidhi was always meant to grow past its own boundary fence. What starts as a working farm is already becoming three more things — each one an extension of the same practice, offered beyond the property."
            />
            <div className="mt-8 flex flex-col gap-5">
              {futureVentures.map((venture) => {
                const Icon = ventureIcons[venture.icon];
                return (
                  <Reveal key={venture.title} delay={0.1}>
                    <div className="flex gap-4 rounded-2xl bg-forest-50 p-5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800 text-cream">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-display text-lg text-forest-950">{venture.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink/65">
                          {venture.description}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-forest-950 py-24">
        <div className="container-nidhi text-center">
          <Reveal className="mx-auto max-w-2xl">
            <p className="text-eyebrow text-sand-300">Registered As</p>
            <h2 className="mt-4 font-display text-3xl text-cream sm:text-4xl">
              {siteConfig.legalName}
            </h2>
            <p className="mt-4 text-cream/60">
              Operating the Hasiru Nidhi nature experience grounds near
              Harohalli, Bengaluru Rural, Karnataka.
            </p>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Come see it for yourself."
        description="The best way to understand Hasiru Nidhi is to spend a day on the grounds. We'd love to host you."
      />
    </>
  );
}
