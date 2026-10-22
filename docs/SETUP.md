# Setup guide — Supabase + Vercel

Nothing here requires code changes. Secrets go only into Vercel / your local `.env.local` — **never into Git or chat**.

## 1. Create the Supabase project
1. https://supabase.com → **New project** (region: *Mumbai / ap-south-1* is closest to Karnataka). Save the database password somewhere safe.
2. **Project Settings → API**: copy the *Project URL* and the *anon/publishable* key. Copy the *service_role* key too (keep it secret).

## 2. Apply the database migrations
**Easiest (one paste):** Supabase dashboard → **SQL Editor → New query**, paste the whole of
[`supabase/setup-all.sql`](../supabase/setup-all.sql) and press **Run**. It contains every migration in order and is only for a **new, empty** project
(running it twice fails; that is intentional so nothing is silently overwritten).

*Or, file by file, in order* (also the way to upgrade an existing database — run only the files you haven't applied):

1. `supabase/migrations/20261017000100_core_schema.sql`
2. `supabase/migrations/20261017000200_rls.sql`
3. `supabase/migrations/20261017000300_reference_data_and_storage.sql` (catalogue vocabulary + the `property-images` and `enquiry-photos` buckets)
4. `supabase/migrations/20261021000100_rate_limits_audit_review_moderation.sql` (form rate limiting, review moderation, admin audit trail)
5. `supabase/migrations/20261021000200_listing_wizard_pricing.sql` (listing-wizard fields, structured pricing, stay-length rules, "become a host", photo limits and ordering)

Verify: **Table editor** shows tables with the 🔒 RLS badge; **Storage** shows the two buckets
(`property-images` public, `enquiry-photos` private).

*(Optional, demo only)* paste `supabase/seed.sql` to add three labelled **sample** listings. Skip this in production.

> **Vercel integration (what it creates):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read by this app; the `POSTGRES_*`, `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY` and unprefixed `SUPABASE_*` variables are server-only and unused (never prefix a secret with `NEXT_PUBLIC_`).
> Build-time settings (image hosts, Content-Security-Policy) read the URL, so **redeploy after the variables appear**.
>
> **Fastest path via Vercel:** in your Vercel project → **Storage → Create / Connect → Supabase** can create the project and fill in
> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` for you (those are exactly the names this app reads).
> You still need to run the SQL above in that new project and set the Auth URLs in step 3, then **redeploy**.

## 3. Configure Authentication
**Authentication → URL Configuration**
* *Site URL*: your production URL (e.g. `https://your-site.vercel.app` or your custom domain)
* *Redirect URLs*: add `https://your-site.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`

**Authentication → Providers → Email**: keep *Confirm email* **on** (users verify their address).
**Authentication → SMTP** (strongly recommended): Supabase's built-in mailer is heavily rate-limited; add a custom SMTP
provider (e.g. Resend, SES) so verification and password-reset e-mails are reliable.
Optional: customise the e-mail templates under **Authentication → Emails**.

## 4. Create the first administrator
1. Sign up on the website with an e-mail address **you control** and click the verification link. (No password is ever put in Git, logs or chat; use *Forgot password* if you lose it.)
2. In `supabase/scripts/create_first_admin.sql` replace `REPLACE_WITH_YOUR_EMAIL@example.com` and run the script in the SQL editor. It refuses to run unless that
   account exists **and its e-mail is verified**, promotes only that account, and writes an audit-log entry.
3. Sign out and in again — the account menu now shows **Admin**. The administrator sign-in page is `/admin/login`.

There is deliberately no in-app way to create or promote an admin (tested: `tests/db/first-admin.test.ts`).

## 5. Deploy on Vercel
1. https://vercel.com → **Add New → Project → Import** `rishabh18795-rgb/hasiru-nidhi-website-2` (Framework: Next.js, defaults are fine).
2. **Environment Variables** (Production + Preview): see the table in the README. Minimum:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. **Deploy.** Then re-check the Supabase Auth *Site URL / Redirect URLs* match the final domain.
4. Custom domain: Vercel **Settings → Domains**, follow the DNS instructions, then update `NEXT_PUBLIC_SITE_URL` and the Supabase URLs.

## 6. Finish the business details
Sign in as admin → **Admin → Settings**: enter the **official WhatsApp number**, support e-mail/phone, and (optionally) an
announcement. Until you do, WhatsApp buttons and contact channels stay hidden — the site never invents numbers.
Check **Admin → Overview → Setup status** for anything still pending (e-mail provider, service-role key, …).

## 7. Optional: transactional e-mail
Create a Resend (or compatible) API key, verify a sending domain, then set `RESEND_API_KEY`, `EMAIL_FROM` and
`ADMIN_NOTIFY_EMAIL` in Vercel. Booking, decision and listing e-mails start sending; until then they are skipped and shown as pending.

## Retiring the old GitHub Pages site
The old static site stays published but frozen. To unpublish: GitHub repo → **Settings → Pages → Unpublish site**.
