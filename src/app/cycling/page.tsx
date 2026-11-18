import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Droplets, HardHat, Sunrise } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Cycling and Outdoors: slow rides near nature stays",
  description: "Cycling as part of a nature stay: why to ride slowly, how to find cycling-friendly stays, and sensible habits for a safe ride.",
  alternates: { canonical: `${basePath}/cycling` },
};

const tips = [
  { icon: HardHat, title: "Helmet and bicycle check", copy: "Wear a helmet, and check the brakes, tyres and saddle before you set off." },
  { icon: Sunrise, title: "Ride in daylight", copy: "Early mornings and late afternoons are cooler and quieter. Tell someone where you are going." },
  { icon: Droplets, title: "Water and sun cover", copy: "Carry drinking water, wear a hat and sunscreen, and take a break when you need one." },
];

export default function CyclingPage() {
  return (
    <>
      <PageHero
        eyebrow="Cycling and outdoors"
        title="Slow miles, open country."
        description="Riding for the view rather than the stopwatch. Cycling is one of the experiences a stay can offer, and a good reason to choose a place in the countryside."
        image={images.cyclistSoloHill}
        crumb="Cycling & Outdoors"
        primaryCta={{ label: "Find cycling-friendly stays", href: "/stays?category=cycling-friendly" }}
        secondaryCta={{ label: "Read the journal guide", href: "/blog/the-slow-case-for-cycling-through-farmland" }}
      />

      <section className="bg-cream py-24">
        <div className="container-nidhi grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Why ride slowly"
              title="The countryside is best at ten kilometres an hour."
              description="At an easy pace you notice a farmer at work, a bird at the edge of a pond, the way early light settles on a field. You do not need to be a cyclist, and you do not need the right kit. You need a sensible bicycle, a quiet road and time."
            />
          </div>
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem]">
            <Image src={images.cyclistsDuo} alt="Two cyclists riding on a tree-lined road in the Karnataka countryside" fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" />
          </Reveal>
        </div>
      </section>

      <section className="bg-forest-50 py-24" aria-labelledby="how-heading">
        <div className="container-nidhi max-w-4xl">
          <SectionHeading eyebrow="How it works here" title="A feature of stays, not a booking of its own." />
          <h2 id="how-heading" className="sr-only">How cycling works on Hasiru Nidhi</h2>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-ink/75">
            <p>Hasiru Nidhi does not sell cycling tours or run routes of its own through this website. Instead, hosts can mark a property as <strong>cycling-friendly</strong> and tag it with the <strong>cycling trails</strong> experience, which means it offers things like bicycles, suggested routes or early-start breakfasts.</p>
            <p>What exactly a stay offers is up to the host and is described on its page. Check the listing, and ask the host about bicycles, routes and local conditions before you travel.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/stays?category=cycling-friendly" size="lg" className="rounded-full bg-forest-800 px-7 text-cream hover:bg-forest-700">Find cycling-friendly stays <ArrowUpRight className="h-4 w-4" /></LinkButton>
            <LinkButton href="/stays?experiences=cycling-trails" variant="outline" size="lg" className="rounded-full border-forest-800/25 px-7 text-forest-900 hover:bg-forest-900/5">Stays with cycling trails</LinkButton>
          </div>
        </div>
      </section>

      <section className="bg-cream py-24" aria-labelledby="safe-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Before you ride" title="Three habits for a safe, unhurried ride." />
          <h2 id="safe-heading" className="sr-only">Safety habits for an unhurried ride</h2>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {tips.map((t) => (
              <li key={t.title} className="rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-cream"><t.icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-5 font-display text-lg text-forest-950">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{t.copy}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink/60">General guidance only. Always follow your host&apos;s advice about local roads, weather and conditions.</p>
        </div>
      </section>

      <section className="bg-sand-50 py-20">
        <div className="container-nidhi max-w-3xl">
          <Reveal>
            <h2 className="font-display text-2xl text-forest-950">Cycling at the Hasiru Nidhi farm</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/70">If you would like to ride during a visit to our own farm, mention it when you <Link href="/book?experience=cycling" className="underline">send an enquiry</Link>. Our team will tell you what can be arranged for your dates. Nothing is booked until you hear back from us.</p>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Plan a ride-friendly escape."
        description="Look for cycling-friendly stays, or tell us what you have in mind."
        primaryLabel="Find cycling-friendly stays"
        primaryHref="/stays?category=cycling-friendly"
        secondaryLabel="Ask our team"
        secondaryHref="/contact"
      />
    </>
  );
}
