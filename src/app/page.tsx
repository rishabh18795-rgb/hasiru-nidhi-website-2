import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, BadgeCheck, CalendarCheck, ChevronDown, Leaf, Receipt, ShieldCheck } from "lucide-react";

import { LinkButton } from "@/components/site/link-button";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { PillarCard } from "@/components/site/pillar-card";
import { ExperienceCard } from "@/components/site/experience-card";
import { TestimonialCard } from "@/components/site/testimonial-card";
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
import { StaySearchBar } from "@/components/stays/search-bar";
import { StayCard } from "@/components/stays/stay-card";
import { getFeaturedStays } from "@/lib/data/stays";
import { getCatalog } from "@/lib/data/catalog";
import { gardeningServices } from "@/lib/validation/enquiries";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [featuredStays, catalog] = await Promise.all([getFeaturedStays(3), getCatalog()]);
  const featuredExperiences = experiences.slice(0, 6);
  const recentPosts = blogPosts.slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-forest-950 py-32">
        <HeroBackdrop image={images.heroSunriseFields} />
        <div className="container-nidhi relative flex flex-col items-start pt-20">
          <Reveal>
            <p className="text-eyebrow text-sand-300!">
              Curated nature stays · Karnataka
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 max-w-4xl font-display text-6xl font-medium leading-[1.02] tracking-tight text-cream sm:text-7xl lg:text-[5.5rem]">
              Escape the City.
              <br />
              Embrace Nature.
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 font-display text-2xl italic text-sand-300 sm:text-3xl">
              Cultivating Nature, Creating Memories.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-cream/75">
              Find farm stays, cottages and eco-retreats hosted by people who love their land —
              reviewed by our team, requested directly with the host, with the price shown
              before you ask. Search by PIN code or place, pick your dates, and slow down.
            </p>
          </Reveal>
          <Reveal delay={0.28}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <LinkButton
                href="/stays"
                size="lg"
                className="rounded-full bg-sand-400 px-8 text-forest-950 hover:bg-sand-300"
              >
                Explore Stays
                <ArrowUpRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton
                href="/host/register"
                variant="outline"
                size="lg"
                className="rounded-full border-cream/30 bg-transparent px-8 text-cream hover:bg-cream/10"
              >
                Become a Host
              </LinkButton>
            </div>
          </Reveal>
          <Reveal delay={0.38} className="mt-10 w-full max-w-5xl">
            <StaySearchBar tone="dark" />
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

      {/* FEATURED STAYS + CATEGORIES */}
      {featuredStays.length > 0 || catalog.categories.length > 0 ? (
        <section className="bg-cream pb-28">
          <div className="container-nidhi">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading eyebrow="Explore Stays" title="Find your quiet place in nature." className="mb-0" />
              <Reveal delay={0.1}>
                <Link href="/stays" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
                  Browse all stays <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Reveal>
            </div>
            {catalog.categories.length > 0 ? (
              <ul className="mt-8 flex flex-wrap gap-3" aria-label="Browse by type">
                {catalog.categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/stays?category=${c.slug}`} className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm text-forest-900 ring-1 ring-forest-900/12 transition-colors hover:bg-forest-50">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {featuredStays.length > 0 ? (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredStays.map((s) => <StayCard key={s.id} stay={s} />)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

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
                alt="A tiled-roof farmhouse verandah near Hasiru Nidhi, Karnataka"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
            <Reveal delay={0.12} className="relative mt-10 aspect-[3/4] overflow-hidden rounded-[2rem]">
              <Image
                src={images.farmhouseCottage}
                alt="A farmhouse cottage courtyard at golden hour"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* GARDENING SERVICES: a separate service line with its own enquiry flow (never part of stay search or booking) */}
      <section id="gardening-services" aria-labelledby="home-gardening-heading" className="bg-forest-50 py-24 sm:py-28">
        <div className="container-nidhi">
          <div className="grid overflow-hidden rounded-[2.5rem] bg-forest-900 text-cream lg:grid-cols-2">
            <div className="relative min-h-[18rem] lg:min-h-[30rem]">
              <Image
                src={images.gardeningTools}
                alt="A child learning to garden among leaves at Hasiru Nidhi"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="inline-flex items-center gap-2 text-eyebrow text-sand-300!">
                <Leaf className="h-4 w-4" aria-hidden="true" /> Gardening Services
              </p>
              <h2 id="home-gardening-heading" className="mt-4 font-display text-4xl font-medium leading-tight sm:text-5xl">
                Gardens designed, planted and cared for.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-cream/75">
                A separate service from our stays. Tell us about your garden, terrace or lawn and
                our team will get back to you. Gardening enquiries never create a stay booking.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Gardening services">
                {gardeningServices.slice(0, 6).map((service) => (
                  <li key={service.value} className="rounded-full bg-cream/10 px-3.5 py-1.5 text-sm text-cream/90 ring-1 ring-cream/20">
                    {service.label}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/gardening#enquire" size="lg" className="rounded-full bg-sand-400 px-7 text-forest-950 hover:bg-sand-300">
                  Enquire Now <ArrowUpRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton href="/gardening" variant="outline" size="lg" className="rounded-full border-cream/30 bg-transparent px-7 text-cream hover:bg-cream/10">
                  About gardening services
                </LinkButton>
              </div>
            </div>
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

      {/* TESTIMONIALS — only rendered when real, verified quotes exist */}
      {testimonials.length > 0 ? (
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
      ) : null}

      {/* PARTNER WITH US */}
      <section className="bg-forest-950 py-24">
        <div className="container-nidhi grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <SectionHeading
            eyebrow="For property owners"
            title="Own a place in nature? List it with us."
            description="Hasiru Nidhi is growing a network of farm stays, cottages, homestays and eco-retreats across Karnataka. Apply to list your property — every listing is reviewed, and you stay in control of your calendar and booking requests."
            tone="light"
          />
          <Reveal delay={0.1} className="flex flex-wrap gap-4 lg:justify-end">
            <LinkButton href="/host/register" size="lg" className="rounded-full bg-sand-400 px-8 text-forest-950 hover:bg-sand-300">
              Create a host account <ArrowUpRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton href="/list-your-property" variant="outline" size="lg" className="rounded-full border-cream/30 bg-transparent px-8 text-cream hover:bg-cream/10">
              How hosting works
            </LinkButton>
          </Reveal>
        </div>
      </section>

      {/* TRUST + COMPANY: only statements the platform actually enforces */}
      <section aria-labelledby="trust-heading" className="bg-cream py-24">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Why Hasiru Nidhi" title="Stays you can request with confidence." className="mb-0" />
          <h2 id="trust-heading" className="sr-only">Why book with Hasiru Nidhi</h2>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: "Every listing is reviewed", copy: "Hosts submit their property and our team reviews it before it appears in search." },
              { icon: BadgeCheck, title: "Request to book", copy: "You send a request and the host confirms. Nothing is booked until they accept." },
              { icon: CalendarCheck, title: "No double bookings", copy: "A date can be confirmed for only one guest, however many people ask." },
              { icon: Receipt, title: "Clear prices", copy: "See the nightly rate, extra-guest and fee breakdown before you send a request." },
            ].map((item) => (
              <li key={item.title} className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/8">
                <item.icon className="h-6 w-6 text-forest-700" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg text-forest-950">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{item.copy}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-ink/55">
            Hasiru Nidhi is operated by Hasiru Nidhi Horizons Private Limited. Read our{" "}
            <Link href="/terms" className="underline">Terms</Link>,{" "}
            <Link href="/privacy" className="underline">Privacy Policy</Link> and{" "}
            <Link href="/cancellation-policy" className="underline">Cancellation Policy</Link>.
          </p>
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
