import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { ExperienceCard } from "@/components/site/experience-card";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { experiences, images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Experiences: cycling, gardens, walks and slow evenings",
  description: "Eight kinds of nature experience that a stay can include, from cycling and garden sessions to stargazing, and how to find stays that offer them.",
  alternates: { canonical: `${basePath}/experiences` },
};

export default function ExperiencesPage() {
  return (
    <>
      <PageHero
        eyebrow="Experiences"
        title="What makes a stay memorable."
        description="A good nature stay is more than a bed. Hosts can tag their property with the experiences they offer, so you can look for the ones you care about."
        image={images.forestRoadGold}
        crumb="Experiences"
        primaryCta={{ label: "Explore available stays", href: "/stays" }}
        secondaryCta={{ label: "Gardening Services (separate)", href: "/gardening" }}
      />

      <section className="bg-cream py-24" aria-labelledby="exp-heading">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Experiences that come with a stay"
            title="Eight ways to spend slow time outdoors."
            description="Choose an experience to see the stays that offer it. What is available depends on each host and each property, so read the listing and ask the host if you are unsure."
          />
          <h2 id="exp-heading" className="sr-only">Experiences you can look for</h2>
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {experiences.map((e) => (
              <StaggerItem key={e.title}>
                <ExperienceCard experience={e} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-forest-50 py-20" aria-labelledby="farm-exp-heading">
        <div className="container-nidhi grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
            <h2 id="farm-exp-heading" className="font-display text-2xl text-forest-950">At the Hasiru Nidhi farm</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/70">Our own farm near Bengaluru welcomes visitors by enquiry. Tell us what you would like to do and when, and our team will reply with what can be arranged. See <Link href="/packages" className="underline">how packages work</Link>.</p>
            <LinkButton href="/book" className="mt-5 rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700">Send an enquiry</LinkButton>
          </div>
          <div className="rounded-3xl bg-forest-900 p-8 text-cream">
            <h2 className="font-display text-2xl">Gardening Services are separate</h2>
            <p className="mt-3 text-base leading-relaxed text-cream/80">If you want help with your own garden, that is a different service with its own enquiry. It never creates a stay booking.</p>
            <LinkButton href="/gardening#enquire" className="mt-5 rounded-full bg-sand-400 px-6 text-forest-950 hover:bg-sand-300">Gardening enquiry <ArrowUpRight className="h-4 w-4" /></LinkButton>
          </div>
        </div>
      </section>

      <CtaBand
        title="Find a stay that offers what you love."
        description="Pick an experience above, or search by PIN code or place."
        primaryLabel="Explore available stays"
        primaryHref="/stays"
        secondaryLabel="Become a host"
        secondaryHref="/become-a-host"
      />
    </>
  );
}
