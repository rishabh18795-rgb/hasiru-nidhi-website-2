import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import { LinkButton } from "@/components/site/link-button";
import { Reveal } from "@/components/site/reveal";
import { images } from "@/lib/content";
import { siteConfig } from "@/lib/site";

interface CtaBandProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function CtaBand({
  title = "Ready to trade the city for a while?",
  description = "Tell us your dates and group size — we'll help you choose the right experience and hold your spot.",
  primaryLabel = "Book Your Experience",
  primaryHref = "/contact",
  secondaryLabel = "Call " + siteConfig.contact.phoneDisplay,
  secondaryHref = `tel:${siteConfig.contact.phone.replace(/\s/g, "")}`,
}: CtaBandProps) {
  return (
    <section className="relative overflow-hidden bg-forest-950 py-28">
      <Image
        src={images.mistyHills}
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-forest-950 via-forest-950/85 to-forest-950" />
      <div className="container-nidhi relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-medium leading-[1.1] tracking-tight text-cream sm:text-5xl">
            {title}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-cream/70">
            {description}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <LinkButton
              href={primaryHref}
              size="lg"
              className="rounded-full bg-sand-400 px-8 text-forest-950 hover:bg-sand-300"
            >
              {primaryLabel}
              <ArrowUpRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton
              href={secondaryHref}
              variant="outline"
              size="lg"
              className="rounded-full border-cream/25 bg-transparent px-8 text-cream hover:bg-cream/10"
            >
              {secondaryLabel}
            </LinkButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
