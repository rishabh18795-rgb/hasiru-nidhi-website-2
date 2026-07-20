# Hasiru Nidhi — Website

Production website for **Hasiru Nidhi Horizons Private Limited**, a nature
experience retreat off Kanakapura Road near Bengaluru. Built with Next.js 16
(App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), and Framer
Motion.

> **Cultivating Nature, Creating Memories.**

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, custom design tokens (forest / olive / earth / sand palette)
- **UI Primitives:** shadcn/ui on Base UI
- **Motion:** Framer Motion (scroll reveals, parallax hero)
- **Forms:** React Hook Form + Zod, submitted client-side (see Deployment —
  this is a static export, so there is no server to run a Server Action)
- **Icons:** Lucide React
- **Fonts:** Fraunces (display/serif) + Manrope (body), via `next/font`

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in
your terminal) to view the site.

### Quality checks

```bash
npm run lint        # ESLint (flat config)
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

All three currently run clean with zero errors and zero warnings.

## Project Structure

```
src/
  app/                  Route segments (App Router) — one folder per page
    about/ blog/ contact/ cycling/ experiences/ faq/ gallery/
    gardening/ landscaping/ nature-stay/ packages/ pricing/
    privacy/ terms/
    layout.tsx          Root layout, fonts, metadata, JSON-LD
    page.tsx            Home page
    sitemap.ts robots.ts opengraph-image.tsx
  components/
    site/               Site-specific components (Navbar, Footer, Reveal,
                         PageHero, CtaBand, cards, contact form, etc.)
    ui/                  shadcn/ui primitives
  lib/
    content.ts           All page copy, imagery map, packages, pricing, FAQs,
                          blog posts — the single source of truth for content
    site.ts               Site config, nav links, contact details
    fonts.ts               next/font definitions
    base-path.ts          GitHub Pages basePath/site URL (see Deployment)
    enquiry-schema.ts   Shared Zod schema for the contact form
public/
  brand/logo-mark.png   Official Hasiru Nidhi logo (client-supplied)
  .nojekyll              Required for GitHub Pages (see Deployment)
.github/workflows/
  deploy-pages.yml       Build + deploy to GitHub Pages on push to main
```

## Content & Design Notes

- **Copy** is original, written specifically for this brief — not templated
  or AI-generic. It lives in [`src/lib/content.ts`](src/lib/content.ts) and
  [`src/lib/site.ts`](src/lib/site.ts); edit there rather than in page files.
- **Photography** is curated stock imagery from Unsplash (free-to-use
  licence), used as premium placeholder photography. **Before launch,
  replace the URLs in `src/lib/content.ts` with real, licensed photography
  of the actual property.**
- **Testimonials** in `content.ts` are placeholder copy in the right tone —
  swap in verified guest quotes before launch.
- **Contact details, address, and pricing** (`src/lib/site.ts`,
  `src/lib/content.ts`) are realistic placeholders and must be confirmed
  against the real business before going live.
- **Contact form** validates in the browser and logs the enquiry to the
  console (`src/app/contact/actions.ts`) but is not yet wired to an
  email/CRM provider — connect a transactional email service (e.g. Resend,
  Postmark) or a form backend (e.g. Formspree) before launch. It runs
  entirely client-side because this is a static export with no backend.
- **Design system**: colour tokens (`forest`, `olive`, `earth`, `sand`,
  `cream`) and typography scale live in `src/app/globals.css` under the
  `@theme` block.

## SEO

- Per-page `generateMetadata` / static `metadata` exports with title
  templates, canonical URLs, and Open Graph/Twitter cards
- Dynamic OG image via `next/og` (`src/app/opengraph-image.tsx`)
- `sitemap.ts` and `robots.ts` (App Router file conventions)
- JSON-LD structured data: `TouristAttraction` (site-wide), `FAQPage`
  (`/faq`), `BlogPosting` (each journal post)

`siteConfig.url` (`src/lib/site.ts`) currently points at the GitHub Pages URL
via `src/lib/base-path.ts`. **Once a custom domain is live, update
`src/lib/base-path.ts` and remove the `basePath`/`assetPrefix` config in
`next.config.ts`** (see below) rather than editing `siteConfig.url` alone.

## Deployment — GitHub Pages (current)

This repo is statically exported (`output: "export"` in `next.config.ts`)
and deployed to **GitHub Pages** by
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
on every push to `main`: it installs, lints, typechecks, builds, and
publishes the `out/` folder via `actions/upload-pages-artifact` +
`actions/deploy-pages`.

**Live URL:** https://rishabh18795-rgb.github.io/hasiru-nidhi-website-2/

### One-time repo setting (required, cannot be done via git push)

GitHub Pages must be configured to build from **GitHub Actions**, not the
default "Deploy from a branch":

> Repo → **Settings → Pages → Build and deployment → Source** → select
> **"GitHub Actions"**.

If this is still set to "Deploy from a branch", the deploy job in the
workflow will fail even though the build succeeds — this is exactly what
caused the README to render in place of the site.

### Why the config looks the way it does

Because this is a **project page** (`username.github.io/repo-name/`, no
custom domain), every internal reference needs the repo name as a prefix:

- `next.config.ts` sets `basePath`/`assetPrefix` to `/hasiru-nidhi-website-2`
  in production only, plus `trailingSlash: true` (GitHub Pages has no
  server to redirect `/about` → `/about/`, so routes must be exported as
  `/about/index.html` and linked with the trailing slash) and
  `images.unoptimized: true` (no image-optimization server on static
  hosting).
- `src/lib/base-path.ts` exports that same prefix for the handful of things
  Next.js does **not** auto-prefix: `next/image` `src`, `metadata.icons`,
  and OG/canonical URLs. (`next/link` and `next/router` *are* auto-prefixed.)
- Server Actions are unsupported by static export, so the contact form
  (`src/app/contact/actions.ts`) is a plain client-callable function, not
  a `"use server"` action.
- `public/.nojekyll` is required — GitHub Pages runs Jekyll by default,
  which silently deletes any folder starting with `_`, including Next's
  `_next` asset folder. Its presence in `public/` means static export
  copies it straight into `out/`.

### Deploying elsewhere later (Vercel, etc.)

Static export is a constraint specific to GitHub Pages. If you move to
Vercel or another Node-capable host, you get back Server Actions and
`next/image` optimization by reverting `next.config.ts` to a normal
config (drop `output`, `basePath`, `assetPrefix`, `trailingSlash`,
`images.unoptimized`) and restoring `"use server"` in
`src/app/contact/actions.ts`.

## Not Yet Wired Up (by design)

These are flagged intentionally rather than faked:

- Email/CRM delivery for contact form submissions
- Real payment/booking backend (the site is enquiry-first — bookings are
  confirmed manually per the Terms & Conditions page)
- Analytics (add your provider of choice in `src/app/layout.tsx`)
- Real property photography and verified guest testimonials
