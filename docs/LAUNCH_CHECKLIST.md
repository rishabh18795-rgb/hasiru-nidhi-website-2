# Marketplace launch checklist

The marketplace code lives on `marketplace/develop`. Nothing below has been done to PRODUCTION yet: production still runs the original site and database, and every marketplace flag is OFF there. This is the order to go live safely.

## 1. Already verified (staging, not production)

| Check | Result |
|---|---|
| Typecheck, lint | clean |
| Unit and database tests (real migrations, in-process Postgres) | all green |
| Staging schema check | 45 of 45 |
| Real-backend workflows (Auth, REST, Storage, RLS) | Phases 3 to 6 green |
| Real-browser tests, desktop and phone | Shop order workflow and Services workflow green |
| Service-role key in browser bundles | none |
| Every table has row level security | enforced by a test |
| Every database function's callers are listed and tested | enforced by a test |

## 2. Decide before launch (owner)

1. Dedicated business e-mail, and SMTP so sign-up, order and request e-mails send.
2. Supabase production Auth settings: Site URL and redirect URLs for the live domain.
3. First administrator account for production.
4. Commission rates for products and services (Admin, Marketplace commission). They stay UNCONFIGURED until you record them.
5. Payment provider, tax (GST) policy and invoices. Until then every order and service request shows UNPAID: PAYMENT NOT CONFIGURED.
6. Return and replacement policy per product category (Admin, Return policies).
7. Vendor document requirements per category (Admin, Marketplace controls).
8. Genuine first vendors, products and providers. Never publish sample data as real.

## 3. Production rollout (needs your explicit go-ahead)

1. Take a backup of the production database.
2. Apply, in order, to PRODUCTION only: `20261120000100_vendors_foundation.sql`, `20261121000100_product_catalogue.sql`, `20261122000100_cart_and_orders.sql`, `20261123000100_services.sql`, `20261124000100_marketplace_commission.sql`. All are additive; none changes an existing table or function.
3. Run `node tests/staging/verify-schema.mjs` equivalents against production (read-only).
4. Merge `marketplace/develop` into `main` and let Vercel deploy. With every flag OFF the public site is unchanged.
5. Create the first administrator, approve the first vendors, add real products and services.
6. Switch flags ON one at a time in Admin, Marketplace controls: vendor registration, then Products, then Orders, then Services. Watch the audit log.

## 4. Roll back

Switch the flags OFF: every marketplace page returns to "opening soon" immediately, with no deploy. Migrations are additive and can stay in place.

## 5. Known limitations (honest list)

- No online payment, refunds, payouts or invoices (decisions D5, D6, D11).
- No e-mail notifications yet: in-app notifications only (SMTP pending).
- Marketplace reviews (verified purchases and completed services) are designed but not built.
- No support-ticket system yet: customers use the existing contact page and order disputes.
- Service appointments use the provider's weekly hours in India time; there is no calendar sync.
- The admin overview shows counts only, no revenue, because nothing is paid.
- A parallel-checkout race test (two buyers, last item) is still to add.
