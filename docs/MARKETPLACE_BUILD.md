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

Every migration is applied to production only after: tests green, rehearsal on the non-production database, a backup, and the owner's approval.

## Phases

| Phase | State |
|---|---|
| 2. Design finalisation | Done (decisions above, Phase 1 audit) |
| 3. Vendor foundation and registration | Built and tested locally (see progress summary) |
| 4 to 9 | Not started |

## Tests

`npm run typecheck`, `npm run lint`, `npm test` (unit and database), `npx playwright test` (browser, no backend).
Signed-in browser flows need a Supabase backend; until the non-production project exists (D12) they are verified at database level only.
