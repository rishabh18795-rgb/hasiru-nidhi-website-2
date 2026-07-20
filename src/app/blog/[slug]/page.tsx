import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { blogPosts } from "@/lib/content";
import { siteConfig } from "@/lib/site";
import { basePath } from "@/lib/base-path";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${basePath}/blog/${post.slug}/` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `${siteConfig.url}/blog/${post.slug}/`,
      publishedTime: post.date,
      images: [{ url: `${siteConfig.url}/opengraph-image` }],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.image,
    datePublished: post.date,
    author: { "@type": "Organization", name: siteConfig.legalName },
    publisher: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="bg-cream pb-28 pt-32">
        <div className="container-nidhi max-w-3xl">
          <Reveal>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to the Journal
            </Link>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-8 text-eyebrow">
              {post.category} · {post.readTime}
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-tight text-forest-950 sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 text-sm text-ink/45">
              {new Date(post.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </Reveal>

          <Reveal delay={0.14} className="relative mt-10 aspect-[16/9] overflow-hidden rounded-[2rem]">
            <Image
              src={post.image}
              alt={post.title}
              fill
              sizes="(min-width: 1024px) 768px, 90vw"
              className="object-cover"
              priority
            />
          </Reveal>

          <Reveal delay={0.2} className="mt-10 flex flex-col gap-6">
            {post.content.map((paragraph, i) => (
              <p key={i} className="text-lg leading-relaxed text-ink/75">
                {paragraph}
              </p>
            ))}
          </Reveal>
        </div>
      </article>
      <CtaBand />
    </>
  );
}
