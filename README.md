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
- **Forms:** React Hook Form + Zod, submitted via a Next.js Server Action
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
    enquiry-schema.ts   Shared Zod schema for the contact form
public/
  brand/logo-mark.png   Official Hasiru Nidhi logo (client-supplied)
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
- **Contact form** validates and logs enquiries server-side
  (`src/app/contact/actions.ts`) but is not yet wired to an email/CRM
  provider — connect a transactional email service (e.g. Resend, Postmark)
  or CRM webhook before launch.
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

Update `siteConfig.url` in `src/lib/site.ts` to the real production domain
before deploying.

## Deployment

The app builds to standard Next.js output and deploys cleanly to Vercel or
any Node-compatible host:

```bash
npm run build
npm run start
```

## Not Yet Wired Up (by design)

These are flagged intentionally rather than faked:

- Email/CRM delivery for contact form submissions
- Real payment/booking backend (the site is enquiry-first — bookings are
  confirmed manually per the Terms & Conditions page)
- Analytics (add your provider of choice in `src/app/layout.tsx`)
- Real property photography and verified guest testimonials
