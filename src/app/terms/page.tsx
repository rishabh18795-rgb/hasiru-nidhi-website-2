import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and conditions for bookings and use of the ${siteConfig.name} website.`,
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <article className="bg-cream py-32">
      <div className="container-nidhi max-w-3xl">
        <p className="text-eyebrow">Legal</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-forest-950 sm:text-5xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-4 text-sm text-ink/50">Last updated: 20 July 2026</p>

        <div className="mt-12 flex flex-col gap-8 text-base leading-relaxed text-ink/75">
          <p>
            These terms govern your use of this website and any booking made
            with {siteConfig.legalName} (&ldquo;Hasiru Nidhi&rdquo;). By
            submitting an enquiry or booking, you agree to the terms below.
          </p>

          <section>
            <h2 className="font-display text-xl text-forest-950">Bookings & Confirmation</h2>
            <p className="mt-3">
              All bookings are subject to availability and are confirmed only
              upon receipt of the applicable advance payment. Enquiries
              submitted through this website do not constitute a confirmed
              booking until acknowledged in writing by our team.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Payments</h2>
            <p className="mt-3">
              A 30% advance is required to hold a booking, with the balance
              payable on arrival unless otherwise agreed in writing. We do
              not collect payment details through this website; all payment
              is arranged directly with our team.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Cancellations & Rescheduling</h2>
            <p className="mt-3">
              Cancellations made more than 7 days before the visit date are
              eligible for a full refund of the advance. Cancellations within
              7 days are eligible for rescheduling, subject to availability,
              but are non-refundable. No-shows are non-refundable.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Guest Conduct & Safety</h2>
            <p className="mt-3">
              Hasiru Nidhi is a working farm. Guests are expected to follow
              posted safety guidance, supervise children and pets at all
              times, and respect the animals, planting beds and equipment on
              the grounds. We reserve the right to ask any guest to leave the
              premises without refund in cases of unsafe or disruptive
              conduct.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Liability</h2>
            <p className="mt-3">
              Outdoor activities such as cycling and farm walks carry
              inherent risk. Guests participate at their own discretion and
              are responsible for assessing their own fitness and their
              children&apos;s supervision needs. Hasiru Nidhi is not liable
              for personal injury arising from failure to follow posted
              safety guidance.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Website Use</h2>
            <p className="mt-3">
              Content on this website, including text, photography and
              branding, is the property of {siteConfig.legalName} unless
              otherwise credited, and may not be reproduced without
              permission.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Governing Law</h2>
            <p className="mt-3">
              These terms are governed by the laws of India, with courts in
              Bengaluru, Karnataka having exclusive jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Contact</h2>
            <p className="mt-3">
              Questions about these terms can be directed to{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="underline underline-offset-2">
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
