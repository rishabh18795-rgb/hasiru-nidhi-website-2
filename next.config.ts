import path from "node:path";
import type { NextConfig } from "next";

// Deployed to GitHub Pages at https://rishabh18795-rgb.github.io/hasiru-nidhi-website-2/
// — a project page with no custom domain, so it must be served from this
// repo sub-path. Keep this literal in sync with `src/lib/base-path.ts`.
const REPO_BASE_PATH = "/hasiru-nidhi-website-2";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? REPO_BASE_PATH : undefined,
  assetPrefix: isProd ? REPO_BASE_PATH : undefined,
  // GitHub Pages needs a real index.html per directory (no server-side
  // rewrites available), so every route is exported as `/route/index.html`.
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // No image optimization server on GitHub Pages (static export only).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
