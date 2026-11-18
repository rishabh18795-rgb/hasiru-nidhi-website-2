import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Leaf, Sprout, TreePine, ArrowUpRight } from "lucide-react";

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
    "A working farm that grew into a marketplace for peaceful nature stays, plus a separate gardening service. The story and values behind Hasiru Nidhi.",
  alternates: { canonical: `${basePath}/about` },
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
        description="Hasiru Nidhi began as a working farm. Today it also connects travellers with nature stays hosted by their owners, and offers gardening services. One belief runs through all of it: the best hospitality is good land, well kept."
        image={images.mistyHills}
        crumb="About"
      />

      <section className="bg-forest-50 py-24" aria-labelledby="today-heading">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Hasiru Nidhi today"
            title="Three ways to be close to nature."
            description="One brand, three clearly separate offerings. Each has its own page and its own way to get in touch."
          />
          <h2 id="today-heading" className="sr-only">What Hasiru Nidhi offers</h2>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { title: "Nature stays", copy: "A marketplace of farm stays, cottages and eco-retreats. Search by PIN code or place, compare real prices, and send a request that the host confirms personally.", href: "/stays", cta: "Explore stays" },
              { title: "For property owners", copy: "List your own property with your photographs and prices, keep control of your calendar, and answer requests from a host dashboard. Our team reviews every listing before it goes live.", href: "/list-your-property", cta: "List your property" },
              { title: "Gardening Services", copy: "Garden design, lawns, plants and ongoing care. This is a separate service: send an enquiry and our team replies. It never creates a stay booking.", href: "/gardening", cta: "Gardening enquiry" },
            ].map((item) => (
              <li key={item.title} className="flex flex-col rounded-2xl bg-white p-7 ring-1 ring-forest-900/8">
                <h3 className="font-display text-xl text-forest-950">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">{item.copy}</p>
                <Link href={item.href} className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-medium text-forest-700 hover:text-forest-900">{item.cta} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
              alt="Wooded hills near Hasiru Nidhi at dusk, Western Ghats-facing countryside"
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
                alt="Fresh produce from the kitchen garden at Hasiru Nidhi"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
            <Reveal delay={0.12} className="relative mt-10 aspect-[3/4] overflow-hidden rounded-[2rem]">
              <Image
                src={images.rosePathway}
                alt="A natural path through the grounds at Hasiru Nidhi"
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
