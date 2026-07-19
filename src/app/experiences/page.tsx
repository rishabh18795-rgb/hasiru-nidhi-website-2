import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { ExperienceCard } from "@/components/site/experience-card";
import { PillarCard } from "@/components/site/pillar-card";
import { CtaBand } from "@/components/site/cta-band";
import { experiences, images, pillars } from "@/lib/content";

export const metadata: Metadata = {
  title: "Experiences",
  description:
    "Nine ways to spend a day at Hasiru Nidhi — from cycling and gardening to bonfire evenings and village walks, near Bengaluru.",
  alternates: { canonical: "/experiences" },
};

export default function ExperiencesPage() {
  return (
    <>
      <PageHero
        eyebrow="Experiences"
        title="Nine ways to spend a day outdoors."
        description="Every experience at Hasiru Nidhi is drawn from the working farm itself — nothing staged, nothing rehearsed for a photo. Mix and match across a stay, or come back for the one that stuck."
        image={images.aerialCanopy}
        crumb="Experiences"
      />

      <section className="bg-forest-950 py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="Four Pillars"
            title="Where every experience is rooted."
            tone="light"
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <PillarCard key={pillar.slug} pillar={pillar} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <SectionHeading
            eyebrow="The Full List"
            title="Everything on offer, grouped by mood."
            description="Book a single experience as part of a Day Escape, or let a longer stay carry you through several."
          />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map((experience) => (
              <StaggerItem key={experience.title}>
                <ExperienceCard experience={experience} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaBand
        title="Not sure where to start?"
        description="Tell us who's coming and what you're hoping for — we'll suggest a mix of experiences that fits your visit."
      />
    </>
  );
}
