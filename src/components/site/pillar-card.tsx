import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Bike, Home, Sprout, TreePine } from "lucide-react";

import type { Pillar } from "@/lib/content";

const icons = { Home, Bike, Sprout, TreePine };

export function PillarCard({ pillar }: { pillar: Pillar }) {
  const Icon = icons[pillar.icon];
  return (
    <Link
      href={pillar.href}
      className="group relative flex h-[26rem] flex-col justify-end overflow-hidden rounded-[2rem] border border-forest-900/8"
    >
      <Image
        src={pillar.image}
        alt={pillar.title}
        fill
        sizes="(min-width: 1024px) 25vw, 90vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/25 to-transparent transition-opacity duration-500 group-hover:from-forest-950/95" />

      <div className="relative flex items-center justify-between px-6 pt-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/15 backdrop-blur-sm">
          <Icon className="h-5 w-5 text-cream" />
        </span>
      </div>

      <div className="relative flex-1" />

      <div className="relative p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sand-300">
          {pillar.label}
        </p>
        <h3 className="mt-2 font-display text-2xl text-cream">{pillar.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">{pillar.summary}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cream opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
          Discover more
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
