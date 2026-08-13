import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { BookingForm } from "@/components/site/booking-form";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Book Your Experience",
  description:
    "Plan your visit to Hasiru Nidhi — tell us what you'd like to experience, when, and who's coming, and we'll help you plan the right visit.",
  alternates: { canonical: `${basePath}/book/` },
};

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-4 w-32 rounded bg-forest-900/10" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="h-11 rounded-lg bg-forest-900/5" />
        <div className="h-11 rounded-lg bg-forest-900/5" />
      </div>
      <div className="h-11 rounded-lg bg-forest-900/5" />
      <div className="h-11 rounded-lg bg-forest-900/5" />
      <div className="h-28 rounded-lg bg-forest-900/5" />
      <div className="h-11 w-48 rounded-full bg-forest-900/10" />
    </div>
  );
}

export default function BookPage() {
  return (
    <>
      <PageHero
        eyebrow="Book Your Experience"
        title="Plan your experience at Hasiru Nidhi."
        description="Tell us what you'd like to experience, when you'd like to visit, and who you're coming with. We'll help you plan the right experience."
        image={images.heroSunriseFields}
        crumb="Book Your Experience"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi max-w-2xl">
          <Reveal className="rounded-[2rem] bg-white p-8 ring-1 ring-forest-900/8 sm:p-10">
            <Suspense fallback={<FormSkeleton />}>
              <BookingForm />
            </Suspense>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-8 text-center text-sm text-ink/50">
              Just have a question first?{" "}
              <Link href="/contact" className="underline underline-offset-2">
                Get in touch
              </Link>{" "}
              instead.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
