import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.legalName} collects, uses and protects your information.`,
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="bg-cream py-32">
      <div className="container-nidhi max-w-3xl">
        <p className="text-eyebrow">Legal</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-forest-950 sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-ink/50">Last updated: 20 July 2026</p>

        <div className="mt-12 flex flex-col gap-8 text-base leading-relaxed text-ink/75">
          <p>
            {siteConfig.legalName} (&ldquo;Hasiru Nidhi&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;) respects your privacy. This policy explains what
            information we collect through this website, how we use it, and
            the choices available to you.
          </p>

          <section>
            <h2 className="font-display text-xl text-forest-950">Information We Collect</h2>
            <p className="mt-3">
              When you submit an enquiry or booking request through our
              Contact page, we collect the details you provide — your name,
              email address, phone number, preferred dates, group size, and
              any message you include. We do not collect payment information
              through this website.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">How We Use It</h2>
            <p className="mt-3">
              We use the information you submit solely to respond to your
              enquiry, confirm bookings, and communicate with you about your
              visit. We do not sell or rent your personal information to
              third parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Cookies & Analytics</h2>
            <p className="mt-3">
              This website may use basic, privacy-respecting analytics to
              understand how visitors use our site and improve it over time.
              These tools do not collect personally identifiable information
              unless you explicitly submit it through a form.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Data Retention</h2>
            <p className="mt-3">
              We retain enquiry and booking information for as long as
              necessary to fulfil your request and maintain business
              records, after which it is securely deleted.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Your Rights</h2>
            <p className="mt-3">
              You may request access to, correction of, or deletion of your
              personal information at any time by writing to{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="underline underline-offset-2">
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Changes to This Policy</h2>
            <p className="mt-3">
              We may update this policy from time to time. Material changes
              will be reflected on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Contact</h2>
            <p className="mt-3">
              Questions about this policy can be directed to{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="underline underline-offset-2">
                {siteConfig.contact.email}
              </a>{" "}
              or {siteConfig.contact.phoneDisplay}.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
