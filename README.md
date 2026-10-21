# Hasiru Nidhi — nature stays & experiences marketplace

Production application for **Hasiru Nidhi Horizons Private Limited** — *Cultivating Nature, Creating Memories.*
A responsive marketing site **plus** a working accommodation marketplace: stay search, property pages,
traveller / host / admin dashboards, listing review, booking requests with double-booking protection,
gardening quote enquiries and partner applications.

| | |
|---|---|
| Framework | Next.js 16 (App Router, React 19, server actions), TypeScript, Tailwind CSS v4 |
| Backend | Supabase — PostgreSQL, Auth, Storage, Row Level Security |
| Hosting | Vercel (full-stack). *GitHub is the source repository.* |
| Tests | Vitest — 184 tests incl. a real-Postgres (PGlite) suite for RLS and booking logic |

> **Deployment note.** The earlier GitHub Pages static export was retired: authentication, server actions and
> booking transactions need a server runtime, which static hosting cannot provide. The last static build remains
> published at the old Pages URL (frozen) until you unpublish it in *Settings → Pages*. Production = Vercel.

## What is implemented

See [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md) for the honest, per-feature status and what is blocked on credentials.

* **Public:** home (with stay search), explore stays (filters, sort, pagination, URL-preserved), stay detail
  (gallery lightbox, availability calendar, booking request, save, report, contact host), experiences, cycling,
  gardening & landscaping services (quote form with private photo upload), nature stay, gallery, packages, pricing,
  journal, FAQ, contact, list-your-property, become-a-host, privacy, terms, cancellation policy, 404.
* **Accounts:** sign up (traveller or host), sign in/out, forgot/reset password, e-mail verification, profile editing.
* **Traveller dashboard** `/dashboard`: bookings by status, cancel, review finished stays, saved stays, notifications.
* **Host portal** `/host`: listing editor (draft → submit → review), photo upload, room types, availability calendar,
  booking-request inbox (accept / decline / cancel), enquiries, partnership-application status.
* **Admin** `/admin`: review queue (approve / reject / suspend / reinstate / feature), user management, bookings,
  enquiries & applications, reports, catalogue, platform settings, setup-status checklist, audit log.

## Quick start (local)

```bash
npm install
cp .env.example .env.local        # fill in the Supabase values — see docs/SETUP.md
npm run dev                       # http://localhost:3000
```

Without Supabase variables the **public marketing site still runs**; account, stay-search and form features show a
clear “coming online” notice instead of breaking. This is also the state a brand-new deployment starts in.

### Quality gates

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest: unit + database policy tests (no Supabase needed)
npm run build        # production build
```

CI (`.github/workflows/ci.yml`) runs all four on every push and pull request.

## Setup you must do (≈20 minutes)

Full step-by-step instructions are in **[docs/SETUP.md](docs/SETUP.md)**:

1. Create a Supabase project and run the four migrations in `supabase/migrations/` (in order).
2. Configure Auth URLs and (recommended) custom SMTP.
3. Create the first administrator with `supabase/scripts/create_first_admin.sql`.
4. Import the GitHub repo into Vercel and set the environment variables.
5. Enter the official WhatsApp number / contact details in **Admin → Settings**.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon/publishable key (safe in the browser; protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | for enquiry photos & e-mail look-ups | **Server only.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Production URL for canonical links, sitemap, e-mail links |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | optional | Official WhatsApp number (digits + country code). Also settable in Admin. WhatsApp buttons are hidden until set. |
| `NEXT_PUBLIC_CONTACT_PHONE`, `NEXT_PUBLIC_CONTACT_EMAIL` | optional | Shown in footer/contact when set. Never invented. |
| `NEXT_PUBLIC_INSTAGRAM_URL`, `…_FACEBOOK_URL`, `…_YOUTUBE_URL` | optional | Social links (hidden when empty) |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Transactional e-mail. When unset, e-mails are *skipped and flagged* (in-app notifications still work). |
| `ADMIN_NOTIFY_EMAIL` | optional | Receives new-enquiry / new-listing alerts |

## Architecture & security model

* **Authorization is enforced in three layers**, none of which trusts the browser:
  1. **Postgres RLS** on every table (deny by default) — `supabase/migrations/…_rls.sql`.
  2. **SECURITY DEFINER workflows** for every privileged change (`request_booking`, `respond_to_booking`,
     `cancel_booking`, `submit_property`, `review_property`, `admin_update_user`). Clients cannot write bookings,
     approve listings or change roles directly; guard triggers also block `role`, `is_suspended`, `status`, `is_featured`.
  3. **Server-side checks** on every protected page and server action (`src/lib/auth.ts`). The proxy
     (`src/proxy.ts`) only refreshes sessions and does an *optimistic* redirect.
* **Roles:** `traveller`, `host`, `admin`. Signup can request `traveller` or `host` only; **no application endpoint can
  create or promote an admin** — see `supabase/scripts/create_first_admin.sql`.
* **Double-booking:** a Postgres exclusion constraint (`bookings_no_confirmed_overlap`) makes overlapping *confirmed*
  stays impossible even under concurrent requests; `request_booking` additionally checks dates, capacity, blocks
  and duplicate requests. A booking is only ever described as confirmed after the host accepts it.
* **Secrets:** the service-role client is `server-only`; a test fails the build if it is imported from client code.
* **Private data:** addresses/contacts live in `property_private` (owner + admin only); enquiry photos use a private bucket.
* **Rate limiting:** public forms, photo-upload tickets, booking requests and listing reports are limited per client (or per
  signed-in user) by `rate_limit_hit()` — counters live in Postgres so the limit holds across serverless instances, and
  only the server (service-role key) may call it. It **fails open** (and logs) if `SUPABASE_SERVICE_ROLE_KEY` is not set.
  Sign-in / sign-up / password reset are additionally throttled by Supabase Auth itself.
* **Content-Security-Policy** and the other security headers are set in `next.config.ts`. Scripts still allow `'unsafe-inline'`
  (Next.js bootstrap scripts; a nonce would force every page to render dynamically) — everything else is locked to this site,
  Supabase and the Google Maps embed.
* **Audit trail:** listing decisions, account changes and review moderation go through audited RPCs; catalogue, settings,
  featuring and enquiry/report triage are recorded by a database trigger (column names only, never values). Admin → *Audit log*.
* **Not yet in place** (recommended before heavy traffic): CAPTCHA on public forms (a honeypot is included — Vercel WAF or
  Cloudflare Turnstile would add one), and automated cleanup of orphaned enquiry uploads. Listing photos are in a *public*
  bucket under unguessable UUID paths.

## Testing

See [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) for the traveller / host / admin walkthrough.

Automated (run with `npm test`):

* `tests/db/*` — boots the **real migrations** in an in-process Postgres and impersonates users via JWT + role:
  signup role assignment, privilege-escalation attempts, listing approval workflow, private-data isolation, booking
  validation, double-booking prevention, cancellation, reviews-only-after-stay, search & filters, enquiry privacy,
  notifications, audit log, and an **app ↔ schema contract** test that checks every table, column and RPC parameter the
  code uses against the migrated schema.
* `tests/unit/*` — filter parsing/sanitising, validation schemas, error mapping, open-redirect protection, contact
  helpers, and **structural security tests** (every protected page/action must authorize; no invented contact details;
  no placeholder testimonials).

* `tests/e2e/*` (`npm run test:e2e`, Playwright, desktop + mobile) — runs against the **production build with no backend
  configured**: every public page renders without horizontal overflow, protected areas redirect, open redirects are
  refused, honest "not connected" states, security headers, robots/sitemap. CI runs it after the build.

**Not automated / blocked:** browser end-to-end flows against a live Supabase project (sign-in, e-mail verification,
storage upload, e-mail delivery) require your Supabase project and cannot run in CI without credentials. Use the manual checklist.

## Adding genuine properties & handling enquiries

* **Sample data:** `supabase/seed.sql` adds three clearly-labelled *Sample listing* demos — **do not run it in
  production** (or delete them: `delete from public.properties where is_sample;`). The seed invents no users, bookings or reviews.
* **Real properties:** the owner signs up as a *host*, adds a property + photos, and submits it; an admin approves it in
  **Admin → Listings**. Or an admin can ask the owner to apply via *List your property*.
* **Enquiries:** *Admin → Enquiries* has contact/booking requests, gardening quotes (with signed-URL photos) and partner
  applications. Triage with status + internal notes. Hosts see enquiries about their own listings.
* **Payments:** not enabled — bookings are requests settled directly with the host. See `src/lib/payments/index.ts` for what
  enabling Razorpay requires.

## Project layout

```
supabase/migrations/   schema, RLS, reference data + storage buckets (apply in order)
supabase/seed.sql      SAMPLE data only
supabase/scripts/      one-off admin bootstrap
src/app/               routes (public site, /stays, /dashboard, /host, /admin, auth)
src/lib/               supabase clients, auth, validation (zod), data access, email, formatting
src/components/        site, forms, app shell, stays, host, admin
tests/db, tests/unit   Vitest suites
```
