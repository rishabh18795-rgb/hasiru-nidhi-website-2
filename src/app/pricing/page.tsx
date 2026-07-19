import type { Metadata } from "next";
import { Check } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { LinkButton } from "@/components/site/link-button";
import { CtaBand } from "@/components/site/cta-band";
import { pricingTiers, images } from "@/lib/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent pricing for Hasiru Nidhi day visits, farmhouse overnights, weekend retreats and corporate offsites near Bengaluru.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple, transparent tariffs."
        description="No hidden charges — every rate below includes the full farm experience. Taxes are added at checkout."
        image={images.mistyHills}
        crumb="Pricing"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <div className="grid gap-6 lg:grid-cols-4">
            {pricingTiers.map((tier) => (
              <Reveal key={tier.name}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-3xl bg-white p-7 ring-1 ring-forest-900/8",
                    tier.featured && "ring-2 ring-forest-700"
                  )}
                >
                  {tier.featured ? (
                    <span className="w-fit rounded-full bg-forest-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cream">
                      Popular
                    </span>
                  ) : (
                    <span className="h-[26px]" />
                  )}
                  <h3 className="mt-4 font-display text-xl text-forest-950">{tier.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-display text-3xl text-forest-950">{tier.price}</span>
                  </div>
                  <p className="text-xs text-ink/50">{tier.unit}</p>
                  <p className="mt-4 text-sm leading-relaxed text-ink/65">{tier.description}</p>
                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-ink/70">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <LinkButton
                    href="/contact"
                    size="lg"
                    className={cn(
                      "mt-7 rounded-full",
                      tier.featured
                        ? "bg-forest-800 text-cream hover:bg-forest-700"
                        : "bg-forest-50 text-forest-900 hover:bg-forest-100"
                    )}
                  >
                    Book Now
                  </LinkButton>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <p className="mt-10 max-w-2xl text-sm leading-relaxed text-ink/50">
              Rates shown are per adult and current as of this season; they
              may vary during peak weekends and public holidays. Children
              under 6 stay and eat free; ages 6–12 are charged 50% of the
              adult rate. Group and corporate pricing is quoted separately —
              see our{" "}
              <a href="/contact" className="underline underline-offset-2">
                contact page
              </a>{" "}
              to enquire.
            </p>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Ready to lock in your dates?"
        description="We hold bookings with a 30% advance — the rest is settled on arrival."
      />
    </>
  );
}
