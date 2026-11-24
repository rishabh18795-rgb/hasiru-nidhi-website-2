import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { blogPosts } from "@/lib/content";
import { listApprovedSlugs } from "@/lib/data/stays";
import { getMarketplaceFlags } from "@/lib/flags";
import { searchProducts, getShopCategories } from "@/lib/data/shop";
import { searchServices, getServiceCategories } from "@/lib/data/services";
import { parseShopFilters } from "@/lib/shop/filters";
import { parseServiceFilters } from "@/lib/services/filters";

export const revalidate = 3600;

const staticRoutes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/stays", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/experiences", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/nature-stay", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/cycling", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/gardening", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/landscaping", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/gardening-landscaping", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/list-your-property", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/become-a-host", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/gallery", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/packages", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/book", priority: 0.9, changeFrequency: "yearly" as const },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly" as const },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/cancellation-policy", priority: 0.3, changeFrequency: "yearly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const routes = staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route.path || "/"}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const posts = blogPosts.map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Only live, non-sample listings are indexed. Drafts, pending, suspended and demo data never appear.
  const stays = (await listApprovedSlugs()).map((s) => ({
    url: `${siteConfig.url}/stays/${s.slug}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Shop and Services appear only while an administrator has switched them ON, and only approved, public listings are listed (the public search
  // functions never return anything else). Bounded to a few pages so a large catalogue cannot slow the sitemap down.
  const flags = await getMarketplaceFlags();
  const market: MetadataRoute.Sitemap = [];
  if (flags.products) {
    market.push({ url: `${siteConfig.url}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    for (const c of await getShopCategories()) market.push({ url: `${siteConfig.url}/shop/${c.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.7 });
    for (let page = 1; page <= 5; page++) {
      const r = await searchProducts({ ...parseShopFilters({}), page }, null);
      for (const p of r.results) market.push({ url: `${siteConfig.url}/shop/p/${p.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
      if (r.results.length < 12) break;
    }
  }
  if (flags.services) {
    market.push({ url: `${siteConfig.url}/services`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    void (await getServiceCategories());
    for (let page = 1; page <= 5; page++) {
      const r = await searchServices({ ...parseServiceFilters({}), page });
      for (const sv of r.results) market.push({ url: `${siteConfig.url}/services/${sv.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
      if (r.results.length < 12) break;
    }
  }

  return [...routes, ...posts, ...stays, ...market];
}
