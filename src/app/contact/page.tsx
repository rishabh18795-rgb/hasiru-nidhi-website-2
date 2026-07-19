import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { ContactForm } from "@/components/site/contact-form";
import { images } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Hasiru Nidhi to plan your visit — day escapes, farmhouse stays, weekend retreats and corporate offsites near Bengaluru.",
  alternates: { canonical: "/contact" },
};

const mapQuery = encodeURIComponent(
  `${siteConfig.contact.address.line1}, ${siteConfig.contact.address.line2}, ${siteConfig.contact.address.city}, ${siteConfig.contact.address.state}`
);

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let's plan your visit."
        description="Share a few details and we'll help you choose the right package, dates and experiences."
        image={images.forestPath}
        crumb="Contact"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi grid gap-14 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <Reveal>
              <h2 className="font-display text-2xl text-forest-950">Reach Us Directly</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">
                Prefer to talk it through? Call or message us on WhatsApp and
                we&apos;ll help you plan on the spot.
              </p>
            </Reveal>

            <div className="mt-8 flex flex-col gap-5">
              <Reveal delay={0.05}>
                <a
                  href={`tel:${siteConfig.contact.phone.replace(/\s/g, "")}`}
                  className="flex items-start gap-4 rounded-2xl bg-forest-50 p-5 transition-colors hover:bg-forest-100"
                >
                  <Phone className="mt-0.5 h-5 w-5 text-forest-700" />
                  <div>
                    <p className="text-sm font-medium text-forest-950">Call Us</p>
                    <p className="text-sm text-ink/60">{siteConfig.contact.phoneDisplay}</p>
                  </div>
                </a>
              </Reveal>
              <Reveal delay={0.1}>
                <a
                  href={siteConfig.contact.whatsapp}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-start gap-4 rounded-2xl bg-forest-50 p-5 transition-colors hover:bg-forest-100"
                >
                  <MessageCircle className="mt-0.5 h-5 w-5 text-forest-700" />
                  <div>
                    <p className="text-sm font-medium text-forest-950">WhatsApp</p>
                    <p className="text-sm text-ink/60">Fastest way to reach us</p>
                  </div>
                </a>
              </Reveal>
              <Reveal delay={0.15}>
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="flex items-start gap-4 rounded-2xl bg-forest-50 p-5 transition-colors hover:bg-forest-100"
                >
                  <Mail className="mt-0.5 h-5 w-5 text-forest-700" />
                  <div>
                    <p className="text-sm font-medium text-forest-950">Email</p>
                    <p className="text-sm text-ink/60">{siteConfig.contact.email}</p>
                  </div>
                </a>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="flex items-start gap-4 rounded-2xl bg-forest-50 p-5">
                  <MapPin className="mt-0.5 h-5 w-5 text-forest-700" />
                  <div>
                    <p className="text-sm font-medium text-forest-950">Visit Us</p>
                    <p className="text-sm text-ink/60">
                      {siteConfig.contact.address.line1},{" "}
                      {siteConfig.contact.address.line2},{" "}
                      {siteConfig.contact.address.city},{" "}
                      {siteConfig.contact.address.state}{" "}
                      {siteConfig.contact.address.postalCode}
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.25} className="mt-6 overflow-hidden rounded-2xl">
              <iframe
                title="Hasiru Nidhi location map"
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                className="h-64 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </Reveal>
          </div>

          <Reveal delay={0.1} className="rounded-[2rem] bg-white p-8 ring-1 ring-forest-900/8 sm:p-10">
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
