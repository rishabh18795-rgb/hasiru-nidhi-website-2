import path from "node:path";
import type { NextConfig } from "next";

// Full-stack deployment (Vercel). The previous GitHub Pages static export was removed because
// authentication, server actions and booking transactions need a server runtime.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
})();

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
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // Property photographs uploaded by hosts live in a public Supabase Storage bucket.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Friendly aliases for the portal entry points. These run before routing, so they can never loop through the
  // protected /host and /admin layouts.
  async redirects() {
    return [
      { source: "/host/register", destination: "/sign-up?type=host", permanent: false },
      { source: "/host/login", destination: "/sign-in?next=%2Fhost", permanent: false },
      { source: "/login", destination: "/sign-in", permanent: false },
      { source: "/register", destination: "/sign-up", permanent: false },
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
