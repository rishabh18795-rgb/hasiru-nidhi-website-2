import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { blogPosts, images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "The Journal: short guides to slower travel",
  description: "Short, practical guides on kitchen gardens, cycling, team days and evenings outdoors, written by the Hasiru Nidhi team.",
  alternates: { canonical: `${basePath}/blog` },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default function BlogIndexPage() {
  const [lead, ...rest] = blogPosts;
  return (
    <>
      <PageHero
        eyebrow="The Journal"
        title="Short guides for slower days."
        description="A small, growing collection of practical writing on gardens, rides, team days and time outdoors. We publish when we have something useful to say."
        image={images.forestLightBeam}
        crumb="Journal"
        primaryCta={{ label: "Read the latest", href: `/blog/${lead.slug}` }}
        secondaryCta={{ label: "Explore available stays", href: "/stays" }}
      />

      <section className="bg-cream py-24" aria-labelledby="lead-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="Latest" title="Start here." />
          <h2 id="lead-heading" className="sr-only">Featured article</h2>
          <Link href={`/blog/${lead.slug}`} className="group mt-10 grid overflow-hidden rounded-[2rem] bg-white ring-1 ring-forest-900/8 focus-visible:outline-2 focus-visible:outline-forest-600 lg:grid-cols-2">
            <span className="relative block aspect-[16/10] lg:aspect-auto lg:min-h-[22rem]">
              <Image src={lead.image} alt="" fill priority sizes="(min-width: 1024px) 50vw, 92vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            </span>
            <span className="flex flex-col justify-center p-8 lg:p-12">
              <span className="text-xs font-medium uppercase tracking-wider text-forest-600">{lead.category} · {lead.readTime}</span>
              <span className="mt-3 font-display text-3xl leading-tight text-forest-950">{lead.title}</span>
              <span className="mt-3 text-base leading-relaxed text-ink/70">{lead.excerpt}</span>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-forest-700">Read the guide <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
            </span>
          </Link>
        </div>
      </section>

      <section className="bg-forest-50 py-24" aria-labelledby="more-heading">
        <div className="container-nidhi">
          <SectionHeading eyebrow="More guides" title="Practical, short and honest." />
          <h2 id="more-heading" className="sr-only">More articles</h2>
          <StaggerGroup className="mt-12 grid gap-6 md:grid-cols-3">
            {rest.map((post) => (
              <StaggerItem key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-forest-900/8 transition-shadow hover:shadow-xl hover:shadow-forest-950/10 focus-visible:outline-2 focus-visible:outline-forest-600">
                  <span className="relative block aspect-[16/10] overflow-hidden">
                    <Image src={post.image} alt="" fill sizes="(min-width: 768px) 30vw, 92vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  </span>
                  <span className="flex flex-1 flex-col p-6">
                    <span className="text-xs font-medium uppercase tracking-wider text-forest-600">{post.category} · {post.readTime}</span>
                    <span className="mt-2 font-display text-xl leading-snug text-forest-950">{post.title}</span>
                    <span className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">{post.excerpt}</span>
                    <span className="mt-4 text-xs text-ink/65">{fmt(post.date)}</span>
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaBand
        title="Ready to put it into practice?"
        description="Find a nature stay that offers the experiences you have been reading about."
        primaryLabel="Explore available stays"
        primaryHref="/stays"
        secondaryLabel="Explore experiences"
        secondaryHref="/experiences"
      />
    </>
  );
}
