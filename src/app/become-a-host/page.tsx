import type { Metadata } from "next";
import { CalendarCheck, Leaf, ShieldCheck, Wallet } from "lucide-react";

import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { HostCta } from "@/components/site/host-cta";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "Become a host",
  description: "Host nature stays with Hasiru Nidhi: manage your own listings, calendar and booking requests from one dashboard. Every listing is reviewed before it goes live.",
  alternates: { canonical: "/become-a-host" },
};

const benefits = [
  { icon: Leaf, title: "A nature-first audience", copy: "Hasiru Nidhi is built for travellers who want greenery, cycling, gardens and slow days — not generic hotel stays." },
  { icon: CalendarCheck, title: "You control the calendar", copy: "Accept or decline every request, block dates for maintenance or personal use, and update details any time." },
  { icon: ShieldCheck, title: "Reviewed, verified listings", copy: "Listings are reviewed by our team before going live, and hosts can earn a verified badge." },
  { icon: Wallet, title: "Clear terms", copy: "Any commission or fee is agreed with you in advance. We don't promise bookings or income." },
];

export default function BecomeAHostPage() {
  return (
    <>
      <PageHero
        eyebrow="Hosting"
        title="Host guests who come for nature."
        description="Create a host account, add your property and photographs, and submit it for review. Once approved, travellers can find it and send you booking requests."
        image={images.cabinMisty}
        crumb="Become a Host"
        primaryCta={{ label: "Start Listing Your Property", href: "/host/properties/new" }}
        secondaryCta={{ label: "Create Host Account", href: "/sign-up?type=host&next=%2Fhost%2Fproperties%2Fnew" }}
      />
      <section className="bg-cream py-24">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Why host here" title="Simple tools, honest terms." />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <StaggerItem key={b.title}>
                <div className="h-full rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-cream"><b.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 font-display text-lg text-forest-950">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">{b.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>
      <section className="bg-cream pb-6 pt-4">
        <div className="container-nidhi"><HostCta /></div>
      </section>
      <section className="bg-sand-50 py-20">
        <div className="container-nidhi max-w-3xl">
          <Reveal>
            <h2 className="font-display text-3xl text-forest-950">What the host portal gives you</h2>
            <ul className="mt-6 space-y-3 text-base leading-relaxed text-ink/75">
              <li>• A step-by-step listing wizard: type, location, details, photographs, facilities, pricing, availability, policies — saved as a draft after every step.</li>
              <li>• An availability calendar and automatic protection against double bookings.</li>
              <li>• A booking-request inbox: accept, decline or cancel, with the guest notified each time.</li>
              <li>• A status tracker: draft, pending review, live, or rejected with the reviewer&apos;s reasons.</li>
            </ul>
          </Reveal>
        </div>
      </section>
      <CtaBand title="Ready to list your property?" description="Apply in a few minutes. You can save a draft and come back later." primaryLabel="Start Listing Your Property" primaryHref="/host/properties/new" secondaryLabel="Create a host account" secondaryHref="/sign-up?type=host&next=%2Fhost%2Fproperties%2Fnew" />
    </>
  );
}
