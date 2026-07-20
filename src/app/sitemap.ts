import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { blogPosts } from "@/lib/content";

export const dynamic = "force-static";

const staticRoutes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/experiences", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/nature-stay", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/cycling", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/gardening", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/landscaping", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/gallery", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/packages", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly" as const },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = staticRoutes.map((route) => ({
    // trailingSlash: true in next.config.ts — match the served path exactly
    // (GitHub Pages has no server to redirect `/about` -> `/about/`).
    url: `${siteConfig.url}${route.path}/`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const posts = blogPosts.map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}/`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...routes, ...posts];
}
