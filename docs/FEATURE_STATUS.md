# Feature status

Legend: ✅ implemented and covered by automated tests · 🟢 implemented, verified by build/lint/visual checks · ⏳ needs your credentials/setup · ❌ not built

| Area | Status | Notes |
|---|---|---|
| Database schema, constraints, indexes, RLS | ✅ | 99 tests against the real migrations |
| Double-booking prevention | ✅ | Postgres exclusion constraint + RPC checks |
| Role-based access (traveller/host/admin) | ✅ | DB policies + server checks + structural tests |
| Admin cannot be self-created | ✅ | guard trigger + RPC refusal; SQL-only bootstrap |
| Listing submit → review → approve/reject/suspend | ✅ | audited, host notified |
| Booking request → host accept/decline → cancel | ✅ | in-app notifications |
| Stay search + filters + availability + pagination | ✅ | RPC `search_properties` tested |
| Public pages, SEO metadata, sitemap, robots, structured data | 🟢 | sample listings are noindex and excluded from sitemap |
| Auth: sign up/in/out, forgot/reset, profile | 🟢⏳ | code complete; needs Supabase project + Auth URL setup for live use |
| Traveller / host / admin dashboards | 🟢⏳ | needs Supabase for live data |
| Image upload (listing photos) | 🟢⏳ | storage policies in migration; needs Supabase Storage |
| Gardening quote form + private photo upload | 🟢⏳ | needs service-role key for signed uploads |
| Contact & “Book your experience” enquiries persisted | 🟢⏳ | stored in `contact_enquiries` once Supabase is connected |
| Partner applications persisted | 🟢⏳ | stored in `partner_applications` |
| WhatsApp buttons | 🟢⏳ | hidden until the official number is configured |
| E-mail notifications | ⏳ | skipped & flagged until `RESEND_API_KEY` + `EMAIL_FROM` are set |
| Online payments | ❌ | intentionally not enabled (needs merchant account); see `src/lib/payments/index.ts` |
| Reviews | ✅ | only the guest of a finished confirmed stay, once |
| Live E2E (browser) tests against Supabase | ⏳ | blocked on a Supabase project; manual checklist provided |
| Rate limiting (forms, uploads, bookings, reports) | ✅ | Postgres counters; needs the service-role key to be active (fails open otherwise) |
| Content-Security-Policy + security headers | 🟢 | verified in a real browser; scripts keep `'unsafe-inline'` (see README) |
| CAPTCHA on public forms | ❌ | honeypot only; add Turnstile / Vercel WAF if spam appears |
| Admin: audit log, review moderation, experiences/catalogue, pending queue | ✅ | `/admin/audit-logs`, `/admin/reviews`, `/admin/catalog`, `/admin/properties?status=pending_review` |
| Portal entry pages `/host/login`, `/host/register`, `/admin/login` (real pages outside the guarded route groups) | ✅ | role re-checked after sign-in; browser + structural tests |
| Aliases `/admin/dashboard`, `/admin/experiences`, `/admin/properties/pending` | 🟢 | redirects (verified by browser tests) |
| Host listing wizard (8 steps, draft saved per step, preview, success page with reference) | 🟢⏳ | validation unit-tested; live save needs Supabase |
| Photo upload (drag-drop, previews, progress, retry, reorder, cover, delete) | 🟢⏳ | validation/error states browser-checked; storage upload needs Supabase |
| Structured pricing (weekend, extra guests, cleaning, tax, min/max stay) + guest price preview | ✅ | SQL and TypeScript maths proven identical on 300 random cases |
| Host entry points (4 CTAs, destination preserved, traveller → host upgrade) | ✅ | browser tests + database tests |
| Per-room pricing / room inventory | ❌ | each confirmed booking reserves the whole property (documented in the wizard) |
| Online payments | ❌ | not enabled; requests are never charged |
| Host-only sign-up (no traveller option), role decided by the server | ✅ | database ignores sign-up metadata; tested |
| Google sign-in (customer + host sign-up/sign-in) | 🟢⏳ | code, cancel/failure paths and cookie security browser-tested; needs the Google provider enabled in Supabase + Google Cloud |
| Show/hide password on every password field | ✅ | browser-tested incl. keyboard and phone width |
| Labelled, validated homepage search | ✅ | unit + browser tests |
| Six labelled sample listings for testing (`supabase/seed.sql`) | ✅ | flagged `is_sample`, noindex, removable with one script |
| Browser smoke tests (desktop + mobile, production build) | ✅ | Playwright, `npm run test:e2e` — covers the no-backend state; live-database flows remain ⏳ |

## Content that is placeholder and needs the owner's confirmation
* Contact address and coordinates on the Contact page/footer, package and pricing figures, FAQ/journal copy, and
  statistics (“12 acres”, “45 minutes”) carry over from the earlier marketing site and have **not** been verified.
* Photography is illustrative stock, not photographs of the real property. Replace with genuine images.
* Cancellation-policy wording is a starting framework and should be reviewed by legal counsel before commercial launch.

## Marketplace PRD build (17 Nov 2026)

| Area | Status | Notes |
|---|---|---|
| PIN-code search (exact PIN, six-digit location treated as PIN, approved listings only) | ✅ | database + demo + unit + browser tests; live data ⏳ (database not installed in production) |
| PIN required to submit an Indian listing | ✅ | `submit_property` refuses a missing/invalid PIN |
| Homepage: "45 minutes" section/claims removed; Gardening Services section; trust + host sections | ✅ | regression test scans all of `src/` |
| Gardening Services page + enquiry form (PIN, preferred date/time), separate admin queue `/admin/gardening` | ✅ ⏳ | never creates a booking; stored/visible once the database exists |
| 20 % commission engine (configurable, snapshot per booking, immutable) | ✅ | 32 database tests incl. rate change, base policy, rounding |
| Commission ledger (append-only), reversal on cancellation / refund | ✅ | tests incl. no negative balances |
| Payments records, admin-recorded payments, refunds | ✅ | **not** a gateway; amounts validated, audited, idempotent on reference |
| Webhook foundation (signature check, idempotent events, 503 until a provider exists) | ✅ | unit + database tests; live provider ❌ |
| Host earnings page, settlements, admin settlement workflow | ✅ ⏳ | settles completed, paid bookings once; transfers happen outside the site |
| Stay completion (host/admin after check-out) | ✅ | closes the previous "no automatic completion" gap (manual, not scheduled) |
| Admin: hosts, host detail/verification, customers, payments, commission, settlements, gardening | ✅ ⏳ | role-protected; live data needs the database |
| Customer booking details page with price breakdown, payment state, status history | ✅ ⏳ | |
| Online payment collection, invoices/receipts, GST, payouts by gateway | ❌ | needs merchant account, accountant decisions and an adapter |
| Property status `archived`, separate `published` flag | ⏳ | approved = published today; archive not built |
