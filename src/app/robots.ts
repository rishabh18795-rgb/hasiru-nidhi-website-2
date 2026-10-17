import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private areas and auth screens must never be indexed.
      disallow: [
        "/dashboard",
        "/host",
        "/admin",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/account-suspended",
        "/auth/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
