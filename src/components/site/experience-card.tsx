import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { ExperienceEntry } from "@/lib/content";
import { cn } from "@/lib/utils";

export function ExperienceCard({
  experience,
  className,
}: {
  experience: ExperienceEntry;
  className?: string;
}) {
  const cardClass = cn(
    "group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/8 transition-shadow duration-300 hover:shadow-xl hover:shadow-forest-950/10",
    className
  );

  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={experience.image}
          alt={experience.title}
          fill
          sizes="(min-width: 1024px) 33vw, 90vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl text-forest-950">{experience.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">
          {experience.description}
        </p>
        {experience.href ? (
          <span className="mt-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-700">
            Learn more
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        ) : null}
      </div>
    </>
  );

  if (experience.href) {
    return (
      <Link href={experience.href} className={cardClass}>
        {body}
      </Link>
    );
  }

  return <div className={cardClass}>{body}</div>;
}
