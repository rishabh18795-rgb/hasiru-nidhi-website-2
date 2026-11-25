# Create the first admin account and set up sign-up e-mail (SMTP)

Plain steps for the owner. Do them **only on the production project after you have approved the launch**, and do the same steps on staging first if you want to practise. Never paste a password or key into chat, GitHub or any file in this project: type it only into the dashboards named below.

Production Supabase project reference: `lgeqyisotgtsnviwonia`. Staging: `wodgrgowxtfucjwbbwwk`. Check the address bar shows the right one before you change anything.

---

## Part 1. Make sign-up e-mails work (SMTP)

Why: Supabase's built-in e-mail sender is only meant for testing and allows just a few messages an hour. With real users, "confirm your e-mail" and "reset password" mails will stop arriving. A real sender fixes that.

### Option A: use the business Gmail (fine for a small pilot)
Limits: roughly 500 mails a day on a free Gmail, so it suits the first few hundred users.

1. Sign in to Google with `hasirunidhiofficial@gmail.com`.
2. Open myaccount.google.com, **Security**, turn on **2-Step Verification** (needed for step 3).
3. Still in Security, search for **App passwords**, create one named `Hasiru Nidhi website`. Google shows a 16-letter password once. Keep that window open until step 6.
4. Open the Supabase dashboard, the **production** project.
5. Go to **Authentication**, then **Emails**, then **SMTP Settings**. Turn on **Enable custom SMTP**.
6. Fill in exactly:
   - Sender email: `hasirunidhiofficial@gmail.com`
   - Sender name: `Hasiru Nidhi`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: `hasirunidhiofficial@gmail.com`
   - Password: the 16-letter app password from step 3 (type it here yourself)
7. **Save**. Then go to **Authentication, Rate Limits** and raise "emails sent per hour" to something sensible such as 60.
8. Test: open the live site in a private window, sign up with a different address you own, and check the confirmation mail arrives (look in spam too). Click the link. Then try **Forgot password**.

### Option B: your own domain and Resend (the proper long-term setup)
Needs a domain you own (for example `hasirunidhi.com`). Mails then come from `hello@yourdomain` and rarely land in spam.
1. Create the mailbox `hello@yourdomain` with your domain provider.
2. Sign up at resend.com, add your domain, add the DNS records it shows, wait for **Verified**.
3. Create an API key in Resend.
4. In Supabase, **Authentication, Emails, SMTP Settings**: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key (type it yourself), sender = `hello@yourdomain`.
5. In Vercel (Production only), add `RESEND_API_KEY`, `EMAIL_FROM` (`Hasiru Nidhi <hello@yourdomain>`) and `ADMIN_NOTIFY_EMAIL` (the address that should be told about new enquiries). Until these exist, the website simply skips e-mail notifications and uses in-app notices; nothing breaks.
Note: a Gmail address cannot be used as a Resend sender. That is why Option B needs a domain.

### Tell Supabase your website address (both options)
**Authentication, URL Configuration**:
- Site URL: your live address (for example `https://hasiru-nidhi.vercel.app`, or your own domain once connected).
- Redirect URLs: add `<live address>/auth/callback` and `<live address>/reset-password`.
Without this, the links in confirmation mails can point to the wrong place.

---

## Part 2. Create the first administrator

There is deliberately no button in the website that can create an admin. Only you, in the database, can. This protects you from anyone promoting themselves.

1. Open the live website. Click **Sign in**, then **Create an account**, using the address that should be the admin (for example `hasirunidhiofficial@gmail.com`). Choose a strong password and save it in a password manager.
2. Open the confirmation e-mail and click the link. (If it does not arrive, Part 1 is not finished.)
3. In the Supabase dashboard (**production** project), open **SQL Editor**, then **New query**.
4. Open the file `supabase/scripts/create_first_admin.sql` from this project, copy everything, and paste it.
5. Change the one line `v_email text := lower('REPLACE_WITH_YOUR_EMAIL@example.com');` so it contains your admin e-mail. Leave everything else.
6. Click **Run**. You should see one row with your e-mail and `admin`. If you see "No VERIFIED account found", step 2 is not done.
7. On the website, sign out and sign in again. The account menu now shows **Admin**.
8. Open **Admin, Marketplace controls** and confirm every module is switched OFF. Switch them on one at a time as described in `docs/SOFT_LAUNCH.md`.

Safety: the script writes an entry in the audit log, refuses to run for unverified accounts, and changes only that one account. To remove admin rights later, ask me for the matching one-line script.
