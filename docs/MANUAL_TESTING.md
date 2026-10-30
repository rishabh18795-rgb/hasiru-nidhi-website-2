# Manual test checklist

Needs a configured Supabase project (see SETUP.md). Use three browsers/profiles (or private windows): traveller, host, admin.
Use throw-away e-mail addresses you control.

## A0. Sign-up, Google and password controls (both account types)
1. `/sign-up` (customer) has **no** role selector; `/sign-up?type=host` (reached from *List Your Property*) says **Create your host account**, has **no** traveller option, and shows the supporting text about verification and approval.
2. Both pages: full name, email, optional phone, password, confirm password, terms checkbox, **Continue with Google**, **Create account**. Every password field has an **eye** button: hidden by default; clicking shows it without clearing the text; the label flips Show/Hide; keyboard (Tab, Enter) works; check it on a phone-width window.
3. Register a host with email → verification mail → link → you land on **/host/properties/new**. In Supabase *Table editor → profiles* the new row has role `host`; a customer sign-up has role `traveller`.
4. **Google** (after enabling the provider): from the host page choose an account → you land in the listing wizard with role `host`. From the customer page → dashboard with role `traveller`. Cancel at Google's screen → back on sign-in with *Google sign-in was cancelled*. Sign in with Google using an email that already has a password account → one account, no duplicate profile.
5. An **existing traveller** pressing *Continue with Google* on the host page is sent to *List your property* with the switch-to-host prompt (never silently upgraded).
6. Homepage **search bar**: labels *Location / Check-in / Check-out / Guests*, placeholders in words, button *Search Stays*. Try check-in only, check-out before check-in, 0 guests → clear messages and no navigation; a valid search opens `/stays` with the filters in the URL.
7. With `seed.sql` applied, `/stays` shows the six demonstration listings, each with a **DEMO LISTING — SAMPLE DATA** badge. Open *Weekend Cycling Retreat*: weekend rate, extra-guest charge and a 2-night minimum in the price breakdown; request a 1-night stay → refused.

## A1. Demo mode and the complete booking flow (no real property needed)

**Demo mode (works right now, no database):** open `/demo/stays`. Six fictional listings built into the site, with a *DEMO MODE* banner on every page. Try the search bar, filters, View Details, the price calculation and the validation messages. The "Request to book (demo)" button says *nothing was saved*; it never claims success. It is separate from the live marketplace and never replaces a failed live request.

**Real end-to-end flow (needs the database: `setup-all.sql`, then `seed.sql`):**
1. Create **two or three throw-away accounts with e-mails you control**: one host (via *Create host account*) and two customers. Verify all e-mails.
2. In the Supabase SQL editor run `supabase/scripts/assign_demo_listings_to_host.sql` with the **host's** e-mail. The demo listings now belong to your test host (otherwise their requests go to the admin inbox).
3. Signed out, open `/stays` → *Book Now* on a card, choose dates and guests in the panel, press **Sign in to request**. After signing in as **customer 1** you must land back on the same property with the same dates and guest count.
4. Press **Request to book** → the success message appears only after saving; it says *not confirmed yet*. **Dashboard → My bookings** shows it as *Awaiting host*.
5. As **customer 2**, request overlapping dates on the same property → also saved (pending requests may overlap).
6. As the **host**: **Host → Bookings → Requests** shows both. Accept customer 1's → it moves to *Confirmed*. Try to accept customer 2's → refused (*dates no longer available*). Decline it instead.
7. Each customer's dashboard shows the new status (*Confirmed* / *Declined*). Customer 1 can cancel → *Cancelled*; the dates become bookable again.
8. Boundaries: customer 1 cannot open `/host` (redirected), cannot see customer 2's booking; a different host sees none of these bookings.
9. Remove everything afterwards: `supabase/scripts/remove_sample_data.sql`.
10. Optional parallel check against the live database: `node scripts/concurrency-check.mjs` (see the header of that file for the environment variables; use test accounts only).

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

## B. Host (listing wizard)
1. On `/list-your-property` signed out: the four buttons work — **Start Listing Your Property** (→ sign-in, then back into the wizard), **Create Host Account**, **Host Login**, **Manage My Properties**.
2. **Create host account** → verification e-mail → link lands you in **/host/properties/new** (Step 1). A traveller account signed in on `/list-your-property` sees a one-click **Start Listing** that converts it to a host account.
3. **Step 1 Type** (name + type) → creates the draft. **Step 2 Location**: PIN must be 6 digits for India; lat/long both-or-neither; choose *approximate* vs *exact* pin. **Step 3 Details**: description ≥ 50 characters; beds/baths/arrangement; add a room type.
4. **Step 4 Photographs**: drag several JPEG/PNG/WebP files (progress bars show); a 6 MB file and a PDF are refused with a clear message; reload the page — the photos are still there; reorder with arrows or drag; **Cover** moves a photo first; **Delete**; to test a failure, switch off Wi-Fi mid-upload and use **Retry**.
5. **Step 5 Facilities**: nothing is pre-ticked. **Step 6 Pricing**: change price/weekend/extra-guest/cleaning/tax — the **price preview** updates; min stay > max stay and half-set extra-guest pricing are refused.
6. **Step 7 Availability**: block dates; try blocking over a confirmed stay → refused. **Step 8 Policies**: tick both declarations; the **preview** shows photos, facilities, location, pricing and policies with Edit links.
7. Use **Save draft** on any step, close the tab, reopen **My properties → Continue** and confirm everything you entered is restored.
8. **Submit for review** is only offered when the checklist is complete; the **success page** with a reference (HN-XXXXXXXX) appears only after the database accepts it. The listing is **not** visible at `/stays` while pending.
9. After the admin *requests changes*, the dashboard shows “Changes requested” with the note; edit and **Resubmit**. After approval it appears in `/stays`. Edit the **name** → back to *Pending review*; edit the **price** → stays live.
10. **Bookings** tabs (Requests / Confirmed / Cancelled / Past): *Accept* one request → confirmed, guest notified. Accept an **overlapping** second request → refused; *Decline* it. Cancel a confirmed booking. A stay shorter/longer than your min/max nights is refused on the stay page and by the server.
11. **Notifications**, **Enquiries**, **Settings** pages work; visit `/admin` as host → redirected.

## C. Admin
1. Sign in as admin → **Overview** (counts, setup status).
2. **Listings → Pending review** (also `/admin/properties/pending`) → open → inspect all fields, private owner details and photos → **Request corrections** or **Reject** (reason required) → host sees the reason and can resubmit (shown as *Resubmission*) → **Approve**.
3. **Suspend** a live listing → disappears from `/stays`; **Reinstate**.
4. **Users**: change a user to host, verify a host, suspend a user (they get *Account suspended* and can't request/host). Confirm admins are not editable.
5. **Enquiries**: contact/booking requests, gardening quotes (photo links open), partner applications → triage with status + notes.
6. **Reviews**: hide a review, then restore it. **Audit log**: confirm the listing decision, user change and review actions above appear with who/when.
7. **Reports**, **Catalogue** (add/deactivate a facility), **Settings** (WhatsApp number → buttons appear on stay/contact/service pages).
8. **Bookings**: filter and cancel.

## D. Public forms (signed out)
* `/contact`, `/book`, `/gardening-landscaping` (with photos), `/list-your-property` → submissions appear in Admin → Enquiries. Empty/invalid submissions show field errors.

## E. Security spot-checks
* Signed out, open `/dashboard`, `/host`, `/admin` → redirected to sign-in with `?next=`.
* Tampering with cookies/localStorage cannot grant host/admin pages (role is read from the database on each request).
* In the browser console, try `fetch` PostgREST directly to `bookings` with `POST`/`PATCH` using your user token → denied.

## F. Deployment smoke test
* Deep-link and refresh `/stays/<slug>`, `/host/properties/<id>`; `/sitemap.xml` lists only live non-sample stays; `/robots.txt` disallows private areas; 404 page works.
