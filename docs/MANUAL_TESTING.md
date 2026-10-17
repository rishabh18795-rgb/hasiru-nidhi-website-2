# Manual test checklist

Needs a configured Supabase project (see SETUP.md). Use three browsers/profiles (or private windows): traveller, host, admin.
Use throw-away e-mail addresses you control.

## A. Traveller
1. **Create account** → *Traveller*; weak password is rejected; verification e-mail arrives; link signs you in.
2. **Sign out / sign in**; wrong password shows a generic error; **Forgot password** e-mail → set new password → signed in.
3. **Explore stays** (`/stays`): search by text; set dates; filter by type, guests, budget, facilities, experiences; sort; pagination; “Clear”. URL keeps the filters; back/forward works.
4. Open a **stay**: gallery lightbox (arrow keys, Esc); availability calendar; **Save** toggles; **Report listing**; **Contact host**.
5. **Request to book** valid dates → success message says *not confirmed*; try: past date, check-out ≤ check-in, too many guests, overlapping your own open request → friendly errors.
6. **Dashboard → My bookings**: request listed as *Awaiting host*; **Cancel** works and shows the policy; **Notifications** show the events.
7. After a stay's check-out date passes (ask the host to confirm, or edit dates in the DB for a test), **Post review** appears once.
8. **Profile**: change name/phone; e-mail is read-only.
9. Visit `/host` and `/admin` as traveller → redirected to dashboard; nothing leaks.

## B. Host
1. **Create account** → *Host*; open **Host portal**; empty states show.
2. **Add a property** → save draft → add ≥1 photo (try a 6 MB file and a PDF: both rejected) → add a room type.
3. Click **Submit for review** with items missing → friendly list of what is missing. Complete them → submit → status *Pending review*; listing is **not** visible at `/stays` while pending.
4. After admin approval it appears in `/stays`. Edit the **name** → status returns to *Pending review* (re-review); edit the **price** → stays live.
5. **Availability**: block dates → the stay page calendar shows them struck out; try blocking over a confirmed booking → refused.
6. **Booking requests**: *Accept* one request → confirmed, guest notified. Accept an **overlapping** second request → refused (“dates no longer available”); *Decline* it. Cancel a confirmed booking.
7. **Enquiries** shows messages sent via “Contact host”. Visit `/admin` as host → redirected.

## C. Admin
1. Sign in as admin → **Overview** (counts, setup status).
2. **Listings → Pending review** → open → inspect private owner details and photos → **Reject** (reason required) → host sees the reason and can resubmit → **Approve**.
3. **Suspend** a live listing → disappears from `/stays`; **Reinstate**.
4. **Users**: change a user to host, verify a host, suspend a user (they get *Account suspended* and can't request/host). Confirm admins are not editable.
5. **Enquiries**: contact/booking requests, gardening quotes (photo links open), partner applications → triage with status + notes.
6. **Reports**, **Catalogue** (add/deactivate a facility), **Settings** (WhatsApp number → buttons appear on stay/contact/service pages).
7. **Bookings**: filter and cancel.

## D. Public forms (signed out)
* `/contact`, `/book`, `/gardening-landscaping` (with photos), `/list-your-property` → submissions appear in Admin → Enquiries. Empty/invalid submissions show field errors.

## E. Security spot-checks
* Signed out, open `/dashboard`, `/host`, `/admin` → redirected to sign-in with `?next=`.
* Tampering with cookies/localStorage cannot grant host/admin pages (role is read from the database on each request).
* In the browser console, try `fetch` PostgREST directly to `bookings` with `POST`/`PATCH` using your user token → denied.

## F. Deployment smoke test
* Deep-link and refresh `/stays/<slug>`, `/host/properties/<id>`; `/sitemap.xml` lists only live non-sample stays; `/robots.txt` disallows private areas; 404 page works.
