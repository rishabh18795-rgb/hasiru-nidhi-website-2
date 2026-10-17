import Link from "next/link";
import type { Metadata } from "next";
import { Camera, ClipboardCheck, Eye, Handshake, MessageSquare, Store } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { PartnerApplicationForm } from "@/components/site/partner-form";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "List your property",
  description: "Partner with Hasiru Nidhi to list your farm stay, cottage, homestay or eco-retreat in Karnataka. Apply online; every listing is reviewed before it goes live.",
  alternates: { canonical: "/list-your-property" },
};

const steps = [
  { icon: MessageSquare, title: "Apply", copy: "Send the short form below, or create a host account to start your listing directly." },
  { icon: Camera, title: "Add your property", copy: "Describe it truthfully and upload your own photographs. Save as a draft any time." },
  { icon: ClipboardCheck, title: "We review it", copy: "Every listing is checked by our team before it is published. Nothing goes live automatically." },
  { icon: Eye, title: "Go live", copy: "Approved listings appear in search and on their own page." },
  { icon: Handshake, title: "Receive requests", copy: "Travellers send booking requests; you accept or decline each one and control your calendar." },
];

const accepted = ["Farm stays", "Village homestays", "Cottages", "Eco-retreats", "Family getaways & villas", "Cycling-friendly stays"];

export default function ListYourPropertyPage() {
  return (
    <>
      <PageHero
        eyebrow="Partner with us"
        title="List your property with Hasiru Nidhi."
        description="Reach travellers looking for quiet, nature-led stays in Karnataka. You stay in control of your property, calendar and house rules."
        image={images.farmhouseCottage}
        crumb="List Your Property"
        primaryCta={{ label: "Apply now", href: "#apply" }}
        secondaryCta={{ label: "Create a host account", href: "/sign-up?type=host" }}
      />

      <section className="bg-cream py-24">
        <div className="container-nidhi">
          <SectionHeading eyebrow="How it works" title="From application to first request." />
          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <StaggerItem key={s.title}>
                <div className="h-full rounded-3xl bg-white p-6 ring-1 ring-forest-900/8">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-800 text-cream"><s.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-forest-600">Step {i + 1}</p>
                  <h3 className="mt-1 font-display text-lg text-forest-950">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">{s.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="bg-sand-50 py-20">
        <div className="container-nidhi grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Who we're looking for" title="Stays that put nature first." />
            <ul className="mt-6 flex flex-wrap gap-3">{accepted.map((a) => <li key={a} className="rounded-full bg-white px-5 py-2 text-sm text-forest-900 ring-1 ring-forest-900/10">{a}</li>)}</ul>
          </div>
          <Reveal className="rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
            <h3 className="font-display text-xl text-forest-950">What to expect — honestly</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink/75">
              <li>• Joining gives your property a place to be discovered. <strong>We do not guarantee bookings or earnings.</strong></li>
              <li>• Guests send <em>requests</em>; a stay is confirmed only when you accept it.</li>
              <li>• Partnership terms (such as any commission or fee) are agreed with you directly before your listing goes live.</li>
              <li>• You can pause or update your listing and calendar whenever you need.</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/become-a-host" className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-900/25 px-6 text-sm font-medium text-forest-900 hover:bg-forest-50"><Store className="h-4 w-4" aria-hidden="true" /> About hosting</Link>
              <WhatsAppButton topic="partner" label="Ask on WhatsApp" />
            </div>
          </Reveal>
        </div>
      </section>

      <section id="apply" className="scroll-mt-24 bg-cream py-24">
        <div className="container-nidhi max-w-3xl">
          <SectionHeading eyebrow="Apply" title="Tell us about your property." description="This creates a partnership application our team will follow up on. Photographs are added in your host account once you have one." />
          <Reveal className="mt-10 rounded-[2rem] bg-white p-8 ring-1 ring-forest-900/8 sm:p-10"><PartnerApplicationForm /></Reveal>
        </div>
      </section>
    </>
  );
}
