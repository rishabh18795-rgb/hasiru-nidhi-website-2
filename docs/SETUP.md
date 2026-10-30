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
6. `supabase/migrations/20261030000100_server_decided_signup_role.sql` (the account role is decided by the server, never by sign-up metadata)

Verify: **Table editor** shows tables with the 🔒 RLS badge; **Storage** shows the two buckets
(`property-images` public, `enquiry-photos` private).

*(Optional, for testing)* paste `supabase/seed.sql` **after** the migrations to add six labelled **sample** listings (farm stay, cottage, eco-retreat, village homestay, villa, lakeside retreat). Every one is flagged `is_sample`, named "Sample …", shown with a *Sample listing* badge, kept out of Google and the sitemap, and has no host, reviews or bookings. Remove them all later with `supabase/scripts/remove_sample_data.sql`.

> **Vercel integration (what it creates):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read by this app; the `POSTGRES_*`, `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY` and unprefixed `SUPABASE_*` variables are server-only and unused (never prefix a secret with `NEXT_PUBLIC_`).
> Build-time settings (image hosts, Content-Security-Policy) read the URL, so **redeploy after the variables appear**.
>
> **Fastest path via Vercel:** in your Vercel project → **Storage → Create / Connect → Supabase** can create the project and fill in
> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` for you (those are exactly the names this app reads).
> You still need to run the SQL above in that new project and set the Auth URLs in step 3, then **redeploy**.

## 3. Configure Authentication
**Authentication → URL Configuration**
* *Site URL*: `https://hasiru-nidhi.vercel.app` (or your custom domain)
* *Redirect URLs*: add `https://hasiru-nidhi.vercel.app/**` and `http://localhost:3000/**`
  (the wildcard matters: verification and password-reset links carry a `?next=` query string, and Supabase only accepts redirects that match the list).

**Authentication → Providers → Email**: keep *Confirm email* **on** (users verify their address).
**Authentication → SMTP** (strongly recommended): Supabase's built-in mailer is heavily rate-limited; add a custom SMTP
provider (e.g. Resend, SES) so verification and password-reset e-mails are reliable.

### Google sign-in (you must enable this; the code side is done)
The site shows **Continue with Google** on the customer and host sign-up and sign-in pages. Until you enable the provider, pressing it shows
"Google sign-in isn't available yet" and nothing breaks.
1. **Google Cloud Console** (https://console.cloud.google.com), using a project that belongs to Hasiru Nidhi: *APIs & Services → OAuth consent screen* (External, app name *Hasiru Nidhi*, your support email), then *Credentials → Create credentials → OAuth client ID → Web application*.
2. In that client, add the **Authorized redirect URI** shown in Supabase under *Authentication → Providers → Google* (it looks like `https://<your-project-ref>.supabase.co/auth/v1/callback`). Copy the generated **Client ID** and **Client secret**.
3. **Supabase → Authentication → Providers → Google**: switch it on and paste the Client ID and Client secret. Keep them out of Git, chat and screenshots.
4. Same-email accounts are linked automatically by Supabase (one `auth.users` row, one profile). The database ignores any role in sign-up metadata, so Google can never make someone a host or admin by itself.

How roles work with Google: the host page sets a short-lived, server-only (httpOnly) cookie saying "host intent". On return, a **brand-new** account is upgraded with the audited `become_host()` function; an **existing traveller** account is sent to *List your property* to switch explicitly; an administrator is never changed. Nothing about roles travels in the URL.

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
