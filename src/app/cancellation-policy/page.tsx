import Link from "next/link";
import type { Metadata } from "next";

import { cancellationPolicies } from "@/lib/validation/property";

export const metadata: Metadata = {
  title: "Cancellation & refund policy",
  description: "How cancellations and refunds work for stays booked through Hasiru Nidhi.",
  alternates: { canonical: "/cancellation-policy" },
};

export default function CancellationPolicyPage() {
  return (
    <article className="bg-cream pb-24 pt-36">
      <div className="container-nidhi max-w-3xl">
        <p className="text-eyebrow">Policies</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">Cancellation &amp; refund policy</h1>
        <div className="mt-10 space-y-8 text-base leading-relaxed text-ink/75">
          <section>
            <h2 className="font-display text-xl text-forest-950">How booking works</h2>
            <p className="mt-3">A booking on Hasiru Nidhi starts as a <strong>request</strong>. It becomes a confirmed reservation only when the host accepts it, and you are notified when that happens. Declined and unanswered requests carry no obligation.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-forest-950">Policy levels</h2>
            <p className="mt-3">Each listing shows one of these policies. The policy that applies to you is the one displayed on the listing and on your booking.</p>
            <ul className="mt-4 space-y-3">
              {cancellationPolicies.map((p) => <li key={p.value} className="rounded-xl bg-white p-4 ring-1 ring-forest-900/10"><span className="font-medium capitalize text-forest-950">{p.value}</span> — {p.label.split("—")[1]?.trim()}</li>)}
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl text-forest-950">Payments and refunds</h2>
            <p className="mt-3">Online payment is not yet part of this platform: any advance or balance is arranged directly between you and the host, and any refund due under the policy above is settled directly with the host. Hasiru Nidhi does not currently hold guest funds. When online payments are introduced, this page will be updated.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-forest-950">Cancelling a booking</h2>
            <p className="mt-3">Travellers can cancel a request or confirmed stay from <Link href="/dashboard/bookings" className="underline">My bookings</Link>. Stays that have already started cannot be cancelled online. If a host cancels a confirmed stay, you are notified immediately and are entitled to a full refund of anything you paid for it.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-forest-950">Disputes</h2>
            <p className="mt-3">If you and a host disagree about a refund, contact us through the <Link href="/contact" className="underline">contact page</Link> and we will try to help resolve it.</p>
          </section>
          <p className="rounded-xl bg-sand-50 p-4 text-sm text-earth-800">These policy terms are a starting framework and should be reviewed by legal counsel before commercial launch.</p>
        </div>
      </div>
    </article>
  );
}
