import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { LinkButton } from "@/components/site/link-button";

interface PageHeroCta {
  label: string;
  href: string;
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  crumb: string;
  primaryCta?: PageHeroCta;
  secondaryCta?: PageHeroCta;
}

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  crumb,
  primaryCta,
  secondaryCta,
}: PageHeroProps) {
  return (
    <section className="relative flex min-h-[64vh] items-end overflow-hidden bg-forest-950 pt-28">
      <Image
        src={image}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/55 to-forest-950/20" />
      <div className="container-nidhi relative pb-16">
        <nav className="mb-6 flex items-center gap-2 text-xs text-cream/55">
          <Link href="/" className="hover:text-cream">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-cream/80">{crumb}</span>
        </nav>
        <p className="text-eyebrow text-sand-300">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1.05] tracking-tight text-cream sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/75">
          {description}
        </p>
        {primaryCta || secondaryCta ? (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {primaryCta ? (
              <LinkButton
                href={primaryCta.href}
                size="lg"
                className="rounded-full bg-sand-400 px-7 text-forest-950 hover:bg-sand-300"
              >
                {primaryCta.label}
                <ArrowUpRight className="h-4 w-4" />
              </LinkButton>
            ) : null}
            {secondaryCta ? (
              <LinkButton
                href={secondaryCta.href}
                variant="outline"
                size="lg"
                className="rounded-full border-cream/30 bg-transparent px-7 text-cream hover:bg-cream/10"
              >
                {secondaryCta.label}
              </LinkButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
