# Setup guide — Supabase + Vercel

Nothing here requires code changes. Secrets go only into Vercel / your local `.env.local` — **never into Git or chat**.

## 1. Create the Supabase project
1. https://supabase.com → **New project** (region: *Mumbai / ap-south-1* is closest to Karnataka). Save the database password somewhere safe.
2. **Project Settings → API**: copy the *Project URL* and the *anon/publishable* key. Copy the *service_role* key too (keep it secret).

## 2. Apply the database migrations
Run these files **in order** (Supabase dashboard → **SQL Editor → New query → paste → Run**), or with the CLI
(`supabase link --project-ref <ref> && supabase db push`):

1. `supabase/migrations/20261017000100_core_schema.sql`
2. `supabase/migrations/20261017000200_rls.sql`
3. `supabase/migrations/20261017000300_reference_data_and_storage.sql` (catalogue vocabulary + the `property-images` and `enquiry-photos` buckets)

Verify: **Table editor** shows tables with the 🔒 RLS badge; **Storage** shows the two buckets
(`property-images` public, `enquiry-photos` private).

*(Optional, demo only)* paste `supabase/seed.sql` to add three labelled **sample** listings. Skip this in production.

## 3. Configure Authentication
**Authentication → URL Configuration**
* *Site URL*: your production URL (e.g. `https://your-site.vercel.app` or your custom domain)
* *Redirect URLs*: add `https://your-site.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`

**Authentication → Providers → Email**: keep *Confirm email* **on** (users verify their address).
**Authentication → SMTP** (strongly recommended): Supabase's built-in mailer is heavily rate-limited; add a custom SMTP
provider (e.g. Resend, SES) so verification and password-reset e-mails are reliable.
Optional: customise the e-mail templates under **Authentication → Emails**.

## 4. Create the first administrator
1. Sign up on the website normally with the admin's e-mail and confirm the e-mail link.
2. Edit the e-mail in `supabase/scripts/create_first_admin.sql` and run it in the SQL editor.
3. Sign in again — the account menu now shows **Admin**.

There is deliberately no in-app way to create or promote an admin.

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
