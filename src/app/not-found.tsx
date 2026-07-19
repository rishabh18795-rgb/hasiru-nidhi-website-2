import Image from "next/image";
import type { Metadata } from "next";
import { Compass } from "lucide-react";

import { LinkButton } from "@/components/site/link-button";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-forest-950">
      <Image
        src={images.pineForestSoft}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-forest-950/40" />
      <div className="container-nidhi relative flex flex-col items-center py-32 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream/10">
          <Compass className="h-7 w-7 text-sand-300" />
        </span>
        <p className="text-eyebrow mt-6 text-sand-300">404</p>
        <h1 className="mt-4 max-w-xl font-display text-4xl text-cream sm:text-5xl">
          Looks like you&apos;ve wandered off the trail.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-cream/70">
          The page you&apos;re looking for doesn&apos;t exist, or has moved.
          Let&apos;s get you back to solid ground.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <LinkButton
            href="/"
            size="lg"
            className="rounded-full bg-sand-400 px-8 text-forest-950 hover:bg-sand-300"
          >
            Back to Home
          </LinkButton>
          <LinkButton
            href="/contact"
            variant="outline"
            size="lg"
            className="rounded-full border-cream/30 bg-transparent px-8 text-cream hover:bg-cream/10"
          >
            Contact Us
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
