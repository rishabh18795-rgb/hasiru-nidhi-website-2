import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs, images } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about visiting Hasiru Nidhi — location, bookings, food, pets and more.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered plainly."
        description="Everything guests most often ask before their first visit. Still unsure? Reach out directly."
        image={images.forestRoadGold}
        crumb="FAQ"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi max-w-3xl">
          <Reveal>
            <Accordion multiple className="flex flex-col gap-1">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={faq.question}
                  value={`item-${i}`}
                  className="rounded-2xl border-b-0! bg-forest-50 px-6 not-last:mb-3"
                >
                  <AccordionTrigger className="py-5 font-display text-base text-forest-950 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-ink/65">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-10 text-sm text-ink/55">
              Didn&apos;t find your answer? Write to us at{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="underline underline-offset-2">
                {siteConfig.contact.email}
              </a>{" "}
              or call {siteConfig.contact.phoneDisplay}.
            </p>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
