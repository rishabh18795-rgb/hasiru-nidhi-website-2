import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";
import { ContactEmailLink, ContactPhoneSuffix } from "@/components/site/contact-inline";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.legalName} collects, uses and protects your information.`,
  alternates: { canonical: `${basePath}/privacy` },
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
        <p className="mt-4 text-sm text-ink/50">Last updated: 17 October 2026</p>

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
              <strong>Enquiries and forms:</strong> your name, email address, phone
              number, preferred dates, group size, project details and any
              message or photographs you choose to send.
            </p>
            <p className="mt-3">
              <strong>Accounts:</strong> if you create an account we store your name,
              email address, optional phone number, account type (traveller or
              host) and your sign-in credentials. Passwords are handled by our
              authentication provider and are never stored in readable form.
            </p>
            <p className="mt-3">
              <strong>Bookings:</strong> the dates, guest numbers and message in a
              booking request, together with your name and contact details at
              the time of the request.
            </p>
            <p className="mt-3">
              <strong>Hosts:</strong> property details, photographs, address and
              contact information you submit for a listing. Your street address
              and private contact details are visible only to you and
              Hasiru Nidhi administrators; they are not shown publicly.
            </p>
            <p className="mt-3">We do not collect or store payment card information through this website.</p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">How We Use It</h2>
            <p className="mt-3">
              We use your information to run your account, respond to
              enquiries, process booking requests, review and publish
              listings, send service messages (such as booking decisions) and
              keep the platform safe. When you send a booking request, the
              host of that property receives your name, phone number, email
              and message so they can respond. We do not sell or rent your
              personal information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-forest-950">Service Providers</h2>
            <p className="mt-3">
              We use trusted infrastructure providers to operate the service:
              a managed database and authentication provider (Supabase) to
              store accounts, listings, bookings and uploaded files, and a
              hosting provider (Vercel) to serve the website. If configured,
              an email provider sends transactional messages. These providers
              process data on our behalf.
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
              You can edit your name and phone number in your account at any
              time. You may also request access to, correction of, or deletion
              of your personal information by writing to{" "}
              <ContactEmailLink />
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
              <ContactEmailLink />{" "}
             <ContactPhoneSuffix prefix="or" />.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
