# Marketplace launch checklist and rollout plan

Branch: `marketplace/develop`. **Production has not been touched**: it still runs the original site and database, and every marketplace flag is OFF there. Nothing below is done to production until the owner approves this list.

## 1. What has been verified (staging project, never production)

See the table at the end of the latest progress report for the exact numbers. Coverage: typecheck and lint; unit and database tests against the real migrations in an in-process Postgres; the staging schema check; real-backend workflows (Auth, REST, Storage, RLS) for vendors, products, orders, services and the original Nature Stay; real-browser journeys on desktop and phone; a whole-site audit (every public, customer, vendor, host and admin page) for errors, broken images, sideways scrolling and accessibility.

## 2. Migrations to run on production, in this order (all additive)

| # | File | Adds | Touches existing objects |
|---|---|---|---|
| M1 | `20261120000100_vendors_foundation.sql` | vendors, capabilities, documents, service areas, OFF flags | extends `platform_settings_validate()` only |
| M3 | `20261121000100_product_catalogue.sql` | categories, products, variants, images, stock log | no |
| M4 | `20261122000100_cart_and_orders.sql` | cart, checkout, orders, shipments, returns, disputes | no |
| M5 | `20261123000100_services.sql` | service categories, listings, requests, quotations, appointments | no |
| M6 | `20261124000100_marketplace_commission.sql` | commission rates (unconfigured), append-only | no |
| M7 | `20261125000100_marketplace_reviews.sql` | verified reviews with moderation | no |

Run each file once, in order, in the Supabase SQL editor of the PRODUCTION project (or paste `supabase/setup-all.sql` only on a brand new project, never on production). A test guarantees the migrations seed only reference data (categories, OFF flags, storage buckets): no vendors, products, orders or people, and nothing labelled demo or staging.

## 3. Rollout plan (needs the owner's explicit approval)

1. **Back up production.** Supabase Dashboard, production project, Database, Backups (if your plan has them). On the Free plan there are no automatic backups: export the key tables (profiles, properties, bookings, payments, gardening_enquiries, platform_settings) as CSV from the Table Editor, and note the time.
2. Read this list once more and confirm which modules you want visible at first.
3. Run M1 to M7 on production (section 2). Each ends with no error. Then confirm: Dashboard, Database, Tables shows the new tables, and Authentication, Policies shows RLS ON for each.
4. Merge `marketplace/develop` into `main`. Vercel deploys. With every flag OFF the public site looks unchanged, and `/shop`, `/services`, `/vendor` show "opening soon".
5. Create the first administrator (section 5). Open Admin, Marketplace controls.
6. Add genuine vendors, products and providers. Approve them one by one.
7. Switch flags ON one at a time: vendor registration, then Products, then Orders, then Services. After each, open the public pages and the audit log.

## 4. Recovery

- **Switch a module OFF** (Admin, Marketplace controls): the pages return to "opening soon" immediately. No deploy needed. This is the first response to any problem.
- **Roll back the database** only if no genuine marketplace data exists yet: run `supabase/rollback/marketplace-rollback.sql` in the SQL editor. A test proves that after it runs the schema matches the pre-marketplace schema exactly. It deletes all marketplace data. Stays, bookings, profiles, properties, enquiries and payments are never touched.
- **If genuine data exists** do not run the rollback: restore from the backup in step 1 or ask for help. Switching the flags OFF is always safe.
- **Roll back the website**: in Vercel, Deployments, pick the previous production deployment, Promote to Production.

## 5. Accounts, email and authentication (do these once the product is approved)

Never paste passwords or keys into chat. Enter them only in the dashboards named here.

1. **Business email.** Create a dedicated mailbox on your domain (for example `hello@your-domain`) with your domain provider or Google Workspace. It receives admin notices and is the sender identity.
2. **Resend (sending email).** resend.com, add your domain, add the DNS records Resend shows, wait for "Verified". Create an API key. In Vercel, Settings, Environment Variables, add for Production: `RESEND_API_KEY`, `EMAIL_FROM` (like `Hasiru Nidhi <hello@your-domain>`), `ADMIN_NOTIFY_EMAIL`.
3. **Supabase SMTP.** Production project, Authentication, SMTP Settings: host `smtp.resend.com`, port 465, username `resend`, password = the Resend API key (enter it there yourself), sender = your business email.
4. **Supabase URLs.** Authentication, URL Configuration: Site URL = your live domain; Redirect URLs = the live domain plus `/auth/callback` and `/reset-password`.
5. **First administrator.** Sign up on the live site with a mailbox you control and verify the email. Then run `supabase/scripts/create_first_admin.sql` in the SQL editor with that email. Nothing in the app can create or promote an admin, and the script records the action in the audit log. **I will not create or promote an admin without your confirmation of the exact account.**
6. **Test accounts.** Create one customer and one vendor with real mailboxes you control, apply as a vendor, and approve it from Admin.
7. **Verify** sign up, email verification, sign in, password reset and sign out on the live site before announcing anything.

## 6. Staging demo data

The staging project holds a labelled demo catalogue ("(demo)"). It cannot reach production: production is a different database, and the migrations contain no demo rows. To clean staging: `node tests/staging/remove-demo.mjs` (dry run), then `--apply`. It removes only records labelled demo or test, archiving anything that orders or requests refer to, and cannot run against any project but staging.

## 7. Honest limits at launch

- No online payment, refunds, payouts, settlements, tax or invoices (decisions D5, D6, D11). Every order and service request reads UNPAID: PAYMENT NOT CONFIGURED. Commission is UNCONFIGURED.
- Email depends on step 5. Until then notifications are in-app only.
- No support-ticket system: customers use the contact page and order disputes.
- No calendar sync for service appointments (weekly hours and days off only).
- Self-registration cannot be tested on staging (Supabase rejects test addresses); it is verified on production with a real mailbox in step 5.7.
