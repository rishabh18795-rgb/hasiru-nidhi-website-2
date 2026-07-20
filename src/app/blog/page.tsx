import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { blogPosts, images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "The Journal",
  description:
    "Notes on gardening, cycling, corporate retreats and slow living from the Hasiru Nidhi team.",
  alternates: { canonical: `${basePath}/blog/` },
};

export default function BlogIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="The Journal"
        title="Notes from the ground."
        description="Short, specific writing on what we're learning from the garden, the trail and the guests who pass through."
        image={images.pineForestSoft}
        crumb="Journal"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <StaggerGroup className="grid gap-8 lg:grid-cols-2">
            {blogPosts.map((post) => (
              <StaggerItem key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-[2rem] bg-white ring-1 ring-forest-900/8 sm:flex-row"
                >
                  <div className="relative aspect-[16/10] sm:aspect-auto sm:w-2/5">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 25vw, 90vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <p className="text-xs font-medium uppercase tracking-wider text-forest-600">
                      {post.category} · {post.readTime}
                    </p>
                    <h2 className="mt-2 font-display text-xl leading-snug text-forest-950">
                      {post.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/60">
                      {post.excerpt}
                    </p>
                    <p className="mt-4 text-xs text-ink/40">
                      {new Date(post.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
