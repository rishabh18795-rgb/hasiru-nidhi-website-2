import path from "node:path";
import type { NextConfig } from "next";

// Full-stack deployment (Vercel). The previous GitHub Pages static export was removed because
// authentication, server actions and booking transactions need a server runtime.
const supabaseUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const supabaseHost = supabaseUrl?.hostname || null;

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Next.js injects small inline bootstrap scripts, so 'unsafe-inline' is still required for
// scripts (a per-request nonce would force every page to render dynamically). Everything else is locked down:
// no third-party scripts, frames only from Google Maps, connections only to this site and Supabase, no plugins,
// and the site cannot be framed.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Production is always HTTPS, so every request is upgraded. The staging browser tests serve the built app over plain http://localhost, where an
  // upgrade would break Next.js's own page-refresh requests; only tests/staging/build.mjs sets HN_LOCAL_HTTP, never Vercel.
  ...(isDev || process.env.HN_LOCAL_HTTP === "1" ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
  ...(process.env.HN_LOCAL_HTTP === "1" ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // Lets the staging browser tests build separately without disturbing the normal build (set only by the test scripts).
  distDir: process.env.HN_DIST_DIR || ".next",
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // AVIF first (typically ~30% smaller than WebP for photographs), WebP as the fallback.
    // WebP only: AVIF encodes ~4x slower on demand (measured 2.1 s vs 0.47 s for the hero), so the first visitor to each image waited longer for no real size win.
    formats: ["image/webp"],
    // 55 is used for full-width decorative photographs that sit under a dark overlay (PageHero); everything else stays at 75. (Before this list existed a requested quality of 65 was silently rounded to 75, so the earlier "smaller hero" change did nothing.)
    qualities: [55, 75],
    // Optimised images are re-encoded at most once a month instead of hourly: at low traffic nearly every visit would otherwise hit a cold re-encode. Uploaded photographs have unique, never-reused paths, so a long cache cannot show a stale image.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Property photographs uploaded by hosts live in a public Supabase Storage bucket.
    // Production Supabase is https on the default port, which is what this resolves to. (A local test backend can use http and a port.)
    remotePatterns: supabaseHost
      ? [{ protocol: supabaseUrl?.protocol === "http:" ? "http" : "https", hostname: supabaseHost, ...(supabaseUrl?.port ? { port: supabaseUrl.port } : {}), pathname: "/storage/v1/object/public/**" }]
      : [],
    // Only ever set by the local verification harness (tests/harness), never in deployment.
    dangerouslyAllowLocalIP: process.env.HN_ALLOW_LOCAL_IMAGES === "1",
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Friendly aliases. (The host and admin login/registration pages are real pages outside the guarded route groups.)
  async redirects() {
    return [
      { source: "/login", destination: "/sign-in", permanent: false },
      { source: "/register", destination: "/sign-up", permanent: false },
      { source: "/host/profile", destination: "/host/settings", permanent: false },
      { source: "/admin/dashboard", destination: "/admin", permanent: false },
      { source: "/admin/properties/pending", destination: "/admin/properties?status=pending_review", permanent: false },
      { source: "/admin/experiences", destination: "/admin/catalog", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
