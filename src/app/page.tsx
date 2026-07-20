import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import { LinkButton } from "@/components/site/link-button";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { PillarCard } from "@/components/site/pillar-card";
import { ExperienceCard } from "@/components/site/experience-card";
import { TestimonialCard } from "@/components/site/testimonial-card";
import { StatRow } from "@/components/site/stat-row";
import { CtaBand } from "@/components/site/cta-band";
import { HeroBackdrop } from "@/components/site/hero-backdrop";
import {
  experiences,
  images,
  pillars,
  testimonials,
  blogPosts,
} from "@/lib/content";
import { siteConfig } from "@/lib/site";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: `${basePath}/` },
};

export default function HomePage() {
  const featuredExperiences = experiences.slice(0, 6);
  const recentPosts = blogPosts.slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="relative flex h-[100svh] min-h-[640px] items-center overflow-hidden bg-forest-950">
        <HeroBackdrop image={images.heroSunriseFields} />
        <div className="container-nidhi relative flex flex-col items-start pt-20">
          <Reveal>
            <p className="text-eyebrow text-sand-300">
              A Nature Experience Retreat · Bengaluru
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 max-w-4xl font-display text-6xl font-medium leading-[1.02] tracking-tight text-cream sm:text-7xl lg:text-[5.5rem]">
              Escape the City.
              <br />
              Experience Nature.
              <br />
              <span className="italic text-sand-300">Create Memories.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-cream/75">
              An hour from Bengaluru, Hasiru Nidhi trades traffic for tree
              cover — working gardens, quiet cycling trails, farmhouse stays
              and evenings by the fire, built around one idea: that nature is
              still the best place to slow down.
            </p>
          </Reveal>
          <Reveal delay={0.28}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <LinkButton
                href="/contact"
                size="lg"
                className="rounded-full bg-sand-400 px-8 text-forest-950 hover:bg-sand-300"
              >
                Book Your Experience
                <ArrowUpRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton
                href="/experiences"
                variant="outline"
                size="lg"
                className="rounded-full border-cream/30 bg-transparent px-8 text-cream hover:bg-cream/10"
              >
                Explore Experiences
              </LinkButton>
            </div>
          </Reveal>
        </div>

        <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-cream/60">
          <span className="text-[11px] uppercase tracking-[0.3em]">Scroll</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>
      </section>

      {/* PHILOSOPHY / STORY */}
      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem]">
            <Image
              src={images.treeOfLife}
              alt="A single mature tree standing in open farmland at Hasiru Nidhi"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="Our Philosophy"
              title="A working farm before it is a resort."
              description="Hasiru Nidhi began as a question we couldn't shake: what would it feel like to build a place around nature's pace instead of the city's? Not a manicured backdrop for photographs, but a living, working landscape — gardens you can put your hands in, trails shaped by the land rather than a landscaper's plan, and rooms designed to hear the rain."
            />
            <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-10">
              {[
                { label: "Cultivate", copy: "A working farm, gardens and nursery, tended year-round." },
                { label: "Slow Down", copy: "No itineraries longer than the day needs to be." },
                { label: "Reconnect", copy: "With land, food and people, in that order." },
              ].map((item) => (
                <div key={item.label} className="max-w-[10.5rem]">
                  <p className="font-display text-lg text-forest-800">{item.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{item.copy}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOUR PILLARS */}
      <section className="bg-forest-950 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Four Pillars"
            title="Everything grows from the same ground."
            description="Stay, ride, grow and design — four ways to spend time at Hasiru Nidhi, each one rooted in the same working landscape."
            tone="light"
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.slug} delay={i * 0.08}>
                <PillarCard pillar={pillar} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-cream py-20">
        <div className="container-nidhi">
          <StatRow />
        </div>
      </section>

      {/* NATURE STAY SPOTLIGHT */}
      <section className="bg-sand-50 py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <SectionHeading
              eyebrow="Nature Stay"
              title="Wake up to birdsong, not traffic."
              description="Our farmhouse rooms and open-air cottages are built into the landscape rather than on top of it — deep verandahs, natural materials, and views chosen over amenities. Every stay includes access to the full working farm: gardens, trails, animals and the bonfire circle after dark."
            />
            <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-4">
              <LinkButton
                href="/nature-stay"
                size="lg"
                className="rounded-full bg-forest-800 px-7 text-cream hover:bg-forest-700"
              >
                Explore Nature Stay
                <ArrowUpRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton
                href="/packages"
                variant="outline"
                size="lg"
                className="rounded-full border-forest-800/25 px-7 text-forest-900 hover:bg-forest-900/5"
              >
                View Packages
              </LinkButton>
            </Reveal>
          </div>
          <div className="order-1 grid grid-cols-2 gap-4 lg:order-2">
            <Reveal className="relative aspect-[3/4] overflow-hidden rounded-[2rem]">
              <Image
                src={images.cabinMisty}
                alt="Rustic cabin at Hasiru Nidhi surrounded by morning mist"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
            <Reveal delay={0.12} className="relative mt-10 aspect-[3/4] overflow-hidden rounded-[2rem]">
              <Image
                src={images.farmhouseCottage}
                alt="Farmhouse cottage at golden hour"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* EXPERIENCES GRID */}
      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow="Experiences"
              title="Nine ways to spend a day outdoors."
              className="mb-0"
            />
            <Reveal delay={0.1}>
              <Link
                href="/experiences"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
              >
                View all experiences
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
          </div>
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredExperiences.map((experience) => (
              <StaggerItem key={experience.title}>
                <ExperienceCard experience={experience} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-forest-50 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Guest Notes"
            title="What a day here tends to leave behind."
            align="center"
            className="mx-auto"
          />
          <StaggerGroup className="mt-14 grid gap-6 lg:grid-cols-2">
            {testimonials.map((testimonial) => (
              <StaggerItem key={testimonial.name}>
                <TestimonialCard testimonial={testimonial} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* GALLERY TEASER */}
      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="A Glimpse" title="The grounds, in a few frames." className="mb-0" />
            <Reveal delay={0.1}>
              <Link
                href="/gallery"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
              >
                Open full gallery
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              images.strawberryHarvest,
              images.bonfireGroup,
              images.rosePathway,
              images.breakfastSpread,
              images.kidsPlayingMisty,
              images.cyclistsDuo,
              images.seedlingsPots,
              images.milkyWay,
            ].map((src, i) => (
              <Reveal
                key={src}
                delay={(i % 4) * 0.06}
                className={`relative overflow-hidden rounded-2xl ${
                  i % 3 === 0 ? "aspect-[3/4]" : "aspect-square"
                }`}
              >
                <Image
                  src={src}
                  alt="Hasiru Nidhi grounds"
                  fill
                  sizes="(min-width: 640px) 22vw, 45vw"
                  className="object-cover transition-transform duration-700 hover:scale-110"
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* JOURNAL TEASER */}
      <section className="bg-sand-50 py-28">
        <div className="container-nidhi">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="The Journal" title="Notes from the ground." className="mb-0" />
            <Reveal delay={0.1}>
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
              >
                Read the journal
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
          </div>
          <StaggerGroup className="mt-14 grid gap-6 lg:grid-cols-3">
            {recentPosts.map((post) => (
              <StaggerItem key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/8"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, 90vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-xs font-medium uppercase tracking-wider text-forest-600">
                      {post.category}
                    </p>
                    <h3 className="mt-2 font-display text-lg leading-snug text-forest-950">
                      {post.title}
                    </h3>
                    <p className="mt-auto pt-4 text-xs text-ink/50">{post.readTime}</p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
