# Marketplace build: decisions and status

Source of truth for the design is the Phase 1 audit (Sections 7 to 10). This file records the owner's decisions and where the build stands. Branch: `marketplace/develop`.

## Owner decisions (19 Nov 2026)

| | Decision |
|---|---|
| D1 | Existing hosts are grandfathered. `ensure_legacy_vendor()` mirrors a host into an approved vendor with the stays capability; properties, bookings and login are untouched. |
| D2 | Unpaid order requests allowed. Payment status always shown as UNPAID / PAYMENT NOT CONFIGURED. Never shown as paid unless a real payment is recorded. |
| D3 | Multi-vendor cart, split into one order per vendor at checkout. |
| D4 | Vendors ship themselves; delivery PIN coverage is mandatory; manual tracking. No invented fees, free shipping or COD. |
| D5 | Product and service commission stays UNCONFIGURED until the owner approves rates. The Stay rate is never reused. |
| D6 | No GST treatment and no invoices until the accountant confirms the policy. |
| D7 | Configurable, category-specific return and replacement policies. No invented windows. |
| D8 | Services start with Gardening; fixed-price and quotation-based; no deposits in release one. |
| D9 | The existing gardening form and every historical enquiry are preserved. |
| D10 | Only verified purchases and completed services can be reviewed; admin moderation. |
| D11 | Payment provider integration stays pending. Manual settlements are recorded transparently. |
| D12 | A separate non-production Supabase environment for migration rehearsal. No billable resource or production infrastructure change without confirming the exact resource and cost first. |
| D13 | Vendor document requirements are configurable by category. No compliance claims. |
| D14 | Controlled launch with genuine vendors, products and providers. Never fake inventory or testimonials. |

## Feature flags (`platform_settings`, public, all OFF)

`marketplace_vendor_registration_enabled`, `marketplace_products_enabled`, `marketplace_services_enabled`.
An administrator switches them at `/admin/marketplace`. Deploying code never exposes a module.

## Migrations (additive, in order)

| File | Status |
|---|---|
| `20261120000100_vendors_foundation.sql` (M1) | Written and tested in-process. NOT applied to any database. |
| `20261121000100_product_catalogue.sql` (M3) | Applied to STAGING only. Not applied to production. |
| `20261122000100_cart_and_orders.sql` (M4) | Applied to STAGING only. Not applied to production. |

Every migration is applied to production only after: tests green, rehearsal on the non-production database, a backup, and the owner's approval.

## Phases

| Phase | State |
|---|---|
| 2. Design finalisation | Done (decisions above, Phase 1 audit) |
| 3. Vendor foundation and registration | Built, tested, CI green on the branch |
| 4. Product catalogue | Built, tested, CI green on the branch. Flags OFF. |
| 5. Cart, checkout, orders | Built; verified in-process, against the real staging backend, and in real browsers (desktop and mobile). Flags OFF. |
| 6 to 9 | Not started |

## Verification harness

`node tests/harness/shop-harness.mjs` runs the real migrations in-process, loads clearly labelled FIXTURE rows through the real database functions, and exposes a minimal PostgREST-compatible front, so the real Shop pages can be rendered and clicked through against real SQL (build and start Next with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x HN_ALLOW_LOCAL_IMAGES=1`). It proves rendering and the app/SQL contract only. It is not a Supabase environment and never touches a real database.

## Tests

`npm run typecheck`, `npm run lint`, `npm test` (unit and database), `npx playwright test` (browser, no backend).
Signed-in browser flows and the full order workflow are verified against the staging project: see `docs/STAGING.md` (`npm run test:staging`, `npm run test:staging:e2e`).
