import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, BadgeCheck, ReceiptText, ScrollText, ShieldCheck } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { images, stayCategories } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Nature Stays: farm stays, cottages and eco-retreats",
  description: "What a nature stay is, the kinds of stay you can find on Hasiru Nidhi, what to expect, and how to search by PIN code or place.",
  alternates: { canonical: `${basePath}/nature-stay` },
};

const expect = [
  { icon: ShieldCheck, title: "Reviewed listings", copy: "Every property is reviewed by our team before it appears in search." },
  { icon: ReceiptText, title: "The full price up front", copy: "Each listing shows a price breakdown for your dates before you send a request." },
  { icon: BadgeCheck, title: "A host who confirms", copy: "You send a request and the host accepts or declines it. Nothing is booked until they accept." },
  { icon: ScrollText, title: "Rules you can read first", copy: "House rules, check-in times and the cancellation policy are shown on the property page." },
];

const steps = [
  ["Search", "Enter a six-digit PIN code or a place, then your dates and the number of guests."],
  ["Choose", "Open a property to see its photographs, amenities, house rules and price breakdown."],
  ["Request", "Send the host a booking request. You can follow its status under My bookings."],
];

export default function NatureStayPage() {
  return (
    <>
      <PageHero
        eyebrow="Nature stays"
        title="Stay close to the land."
        description="A nature stay swaps the city for fields, trees and quiet. Find farm stays, cottages and eco-retreats listed by their owners, or list your own."
        image={images.cabinMisty}
        crumb="Nature Stay"
        primaryCta={{ label: "Explore available stays", href: "/stays" }}
        secondaryCta={{ label: "List your property", href: "/list-your-property" }}
      />

      <section className="bg-cream py-24">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="What it means"
              title="Less hotel, more place."
              description="A nature stay is built around where it is: a working farm, a village home, a cottage among trees. The point is not luxury for its own sake but rest, fresh air and time that moves at the pace of the landscape. You may share a garden with the people who tend it, hear birds before alarms, and eat what the season allows."
            />
            <Reveal delay={0.12}>
              <p className="mt-5 text-base leading-relaxed text-ink/70">
                What each stay offers differs from property to property, and that is the charm. Read the listing carefully: it tells you what is included, what the house rules are and what the host can arrange.
              </p>
            </Reveal>
          </div>
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem]">
            <Image src={images.farmhouseCottage} alt="A tiled-roof farmhouse courtyard at golden hour" fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" />
          </Reveal>
        </div>
      </section>

      <section className="bg-forest-50 py-24" aria-labelledby="kinds-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Kinds of stay" title="Six ways to stay near nature." description="These are the categories hosts choose from and guests can filter by. Availability depends on which properties are live." />
          <h2 id="kinds-heading" className="sr-only">Kinds of nature stay</h2>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stayCategories.map((c) => (
              <li key={c.slug}>
                <Link href={`/stays?category=${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/8 transition-shadow hover:shadow-xl hover:shadow-forest-950/10 focus-visible:outline-2 focus-visible:outline-forest-600">
                  <span className="relative block aspect-[16/10] overflow-hidden">
                    <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  </span>
                  <span className="flex flex-1 flex-col p-6">
                    <span className="font-display text-xl text-forest-950">{c.name}</span>
                    <span className="mt-1.5 flex-1 text-sm leading-relaxed text-ink/65">{c.description}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest-700">Browse {c.name.toLowerCase()} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-cream py-24" aria-labelledby="expect-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="What to expect" title="Clear, careful and personal." />
          <h2 id="expect-heading" className="sr-only">What to expect when you book</h2>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {expect.map((e) => (
              <li key={e.title} className="rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-cream"><e.icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-5 font-display text-lg text-forest-950">{e.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{e.copy}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm text-ink/60">Payment is not collected on this website yet. Sending a request costs nothing, and payment arrangements are shared when a booking is confirmed. See <Link href="/pricing" className="underline">how pricing works</Link>.</p>
        </div>
      </section>

      <section className="bg-sand-50 py-24" aria-labelledby="find-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="How to find a stay" title="Three simple steps." />
          <h2 id="find-heading" className="sr-only">How to find and request a stay</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map(([t, c], i) => (
              <li key={t} className="rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                <span className="font-display text-4xl text-sand-500">{i + 1}</span>
                <h3 className="mt-2 font-display text-xl text-forest-950">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{c}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            <LinkButton href="/stays" size="lg" className="rounded-full bg-forest-800 px-7 text-cream hover:bg-forest-700">Explore available stays <ArrowUpRight className="h-4 w-4" /></LinkButton>
            <LinkButton href="/demo/stays" variant="outline" size="lg" className="rounded-full border-forest-800/25 px-7 text-forest-900 hover:bg-forest-900/5">Preview with demo listings</LinkButton>
          </div>
        </div>
      </section>

      <section className="bg-cream py-24" aria-labelledby="farm-heading">
        <div className="container-nidhi grid gap-10 lg:grid-cols-2">
          <div id="farm" className="rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
            <h2 id="farm-heading" className="font-display text-2xl text-forest-950">At the Hasiru Nidhi farm</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/70">Hasiru Nidhi began as a working farm near Bengaluru. If you would like to stay or spend a day at our own farm, tell us your dates and group size. Our team replies to confirm what is available. Farm visits are arranged by enquiry and are separate from the marketplace listings above.</p>
            <LinkButton href="/book?experience=nature-stay" className="mt-5 rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700">Enquire about the farm</LinkButton>
          </div>
          <div className="rounded-3xl bg-forest-900 p-8 text-cream">
            <h2 className="font-display text-2xl">Own a property in nature?</h2>
            <p className="mt-3 text-base leading-relaxed text-cream/80">List it with your own photographs and prices, keep control of your calendar, and answer booking requests from your host dashboard. Our team reviews every listing before it goes live.</p>
            <LinkButton href="/become-a-host" className="mt-5 rounded-full bg-sand-400 px-6 text-forest-950 hover:bg-sand-300">Become a host</LinkButton>
          </div>
        </div>
      </section>

      <CtaBand
        title="Ready to find your quiet place?"
        description="Search by PIN code or place and see the full price before you ask."
        primaryLabel="Explore available stays"
        primaryHref="/stays"
        secondaryLabel="List your property"
        secondaryHref="/list-your-property"
      />
    </>
  );
}
