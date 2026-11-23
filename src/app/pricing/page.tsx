import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";
import { cancellationPolicies } from "@/lib/validation/property";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Pricing: how stays are priced and booked",
  description: "How property pricing works, what the price breakdown shows, how a booking request moves forward, and why online payment is not available yet.",
  alternates: { canonical: `${basePath}/pricing` },
};

const breakdown = [
  ["Nightly rate", "Set by the host. Some hosts set a different weekend rate."],
  ["Extra-guest charge", "Some hosts charge for guests above a stated number."],
  ["Cleaning fee", "A one-time charge, if the host has set one."],
  ["Tax", "Shown as a percentage, if the host has set one."],
  ["Minimum and maximum stay", "Shown on the listing, and applied when you choose dates."],
];

const process = [
  ["Check the price", "Pick your dates and guests on the property page. The breakdown for your dates appears before you send anything."],
  ["Send a request", "Sending a request costs nothing. The host accepts or declines it."],
  ["Arrange payment", "Payment is not collected on this website yet. Advance and balance are arranged between you and the host once the request is accepted."],
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Know the price before you ask."
        description="Each property sets its own price. The full breakdown for your dates is shown on the listing before you send a request."
        image={images.cabinMisty}
        crumb="Pricing"
        primaryCta={{ label: "Explore available stays", href: "/stays" }}
        secondaryCta={{ label: "Cancellation policy", href: "/cancellation-policy" }}
      />

      <section className="bg-cream py-24" aria-labelledby="how-priced">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Property pricing" title="Set by each host, shown in full." description="There is no single tariff, because every property is different. Instead of a rate card, each listing shows what a stay would cost for the dates you choose." />
          <h2 id="how-priced" className="sr-only">What a price breakdown can include</h2>
          <dl className="mt-12 grid gap-4 md:grid-cols-2">
            {breakdown.map(([t, c]) => (
              <div key={t} className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/8">
                <dt className="font-display text-lg text-forest-950">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink/65">{c}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-ink/65">What appears depends on the host. If a charge is not shown on a listing, it has not been set.</p>
        </div>
      </section>

      <section className="bg-forest-50 py-24" aria-labelledby="process-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="From request to stay" title="Three steps, and payment is not one of them yet." />
          <h2 id="process-heading" className="sr-only">How booking and payment work</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {process.map(([t, c], i) => (
              <li key={t} className="rounded-3xl bg-white p-7 ring-1 ring-forest-900/8">
                <span className="font-display text-4xl text-sand-500">{i + 1}</span>
                <h3 className="mt-2 font-display text-xl text-forest-950">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{c}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl rounded-2xl bg-white p-5 text-sm leading-relaxed text-ink/70 ring-1 ring-forest-900/8"><strong className="text-forest-950">Online payment is not set up on this website.</strong> Hasiru Nidhi does not currently collect or hold guest payments. Please do not send money to anyone claiming to take payment on our behalf. When online payment is introduced, this page will say so.</p>
        </div>
      </section>

      <section className="bg-cream py-24" aria-labelledby="cancel-heading">
        <div className="container-nidhi max-w-4xl">
          <SectionHeading eyebrow="Cancellations" title="Each listing shows its policy." />
          <h2 id="cancel-heading" className="sr-only">Cancellation policies</h2>
          <ul className="mt-10 space-y-3">
            {cancellationPolicies.map((p) => (
              <li key={p.value} className="rounded-2xl bg-white p-5 ring-1 ring-forest-900/8"><span className="font-medium capitalize text-forest-950">{p.value}</span>: {p.label.split("—")[1]?.trim()}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink/65">Read the full <Link href="/cancellation-policy" className="underline">cancellation and refund policy</Link>.</p>
        </div>
      </section>

      <section className="bg-sand-50 py-20">
        <div className="container-nidhi grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
            <h2 className="font-display text-2xl text-forest-950">The Hasiru Nidhi farm</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/70">Prices for visits to our own farm are confirmed by our team when you enquire. There is no published rate card.</p>
            <LinkButton href="/book" className="mt-5 rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700">Send an enquiry</LinkButton>
          </div>
          <div className="rounded-3xl bg-white p-8 ring-1 ring-forest-900/8">
            <h2 className="font-display text-2xl text-forest-950">Gardening Services</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/70">Gardening work is quoted separately after an enquiry. It is not part of stay pricing.</p>
            <LinkButton href="/gardening#enquire" variant="outline" className="mt-5 rounded-full border-forest-800/25 px-6 text-forest-900 hover:bg-forest-900/5">Gardening enquiry</LinkButton>
          </div>
        </div>
      </section>

      <CtaBand
        title="Ready to see real prices?"
        description="Search for a stay and choose your dates to see the full breakdown."
        primaryLabel="Explore available stays"
        primaryHref="/stays"
        secondaryLabel="List your property"
        secondaryHref="/list-your-property"
      />
    </>
  );
}
