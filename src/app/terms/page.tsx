import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";
import { ContactEmailLink } from "@/components/site/contact-inline";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and conditions for bookings and use of the ${siteConfig.name} website.`,
  alternates: { canonical: `${basePath}/terms` },
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
            <h2 className="font-display text-xl text-forest-950">Bookings &amp; Confirmation</h2>
            <p className="mt-3">
              All bookings are subject to availability. A request or enquiry
              submitted through this website is <strong>not</strong> a confirmed
              booking. For stays listed by hosts, a booking is confirmed when
              the host accepts your request and you are notified through your
              account. For Hasiru Nidhi&apos;s own stays and experiences, a
              booking is confirmed when our team acknowledges it in writing.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Payments</h2>
            <p className="mt-3">
              This website does not currently take online payments or collect
              payment details. Any advance or balance is arranged directly
              between you and the host (or, for Hasiru Nidhi&apos;s own
              experiences, with our team), and the amounts and timing are
              confirmed at the time of booking. Prices shown on the website
              are indicative until confirmed.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Cancellations &amp; Rescheduling</h2>
            <p className="mt-3">
              Stays listed by hosts follow the cancellation policy shown on the
              listing and on your booking; see our{" "}
              <a href="/cancellation-policy" className="underline underline-offset-2">Cancellation &amp; Refund Policy</a>.
              For Hasiru Nidhi&apos;s own experiences, cancellation and
              rescheduling terms are confirmed in writing when you book.
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
            <h2 className="font-display text-xl text-forest-950">Accounts</h2>
            <p className="mt-3">
              You are responsible for keeping your sign-in details secure and
              for activity under your account. You must provide accurate
              information. We may suspend accounts that breach these terms or
              put others at risk.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Listings, Hosts and Travellers</h2>
            <p className="mt-3">
              Properties on the platform are offered by independent hosts.
              Every listing is reviewed by Hasiru Nidhi before it is
              published, but we do not own, operate or control listed
              properties unless a listing says it is managed by Hasiru Nidhi.
              Hosts are responsible for the accuracy of their listings, the
              safety of their premises, and for holding any licences their
              property requires. A booking <em>request</em> is not a reservation:
              a stay is confirmed only when the host accepts it and you are
              notified. We do not guarantee that any listing will receive
              bookings or any level of income.
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
              <ContactEmailLink />
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
