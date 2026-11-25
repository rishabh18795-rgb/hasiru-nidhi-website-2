# What can break during the first 100 real users

Ordered by how likely and how damaging. "Fix" says who acts. Nothing here is hypothetical filler: each item comes from something I measured or read in the code.

## Will probably bite, fix before inviting anyone
| # | Risk | Why it happens | Fix |
|---|---|---|---|
| 1 | **Sign-up and password-reset e-mails stop arriving** | Supabase's built-in sender allows only a few mails an hour. Staging shows no custom sender is set; production is unconfirmed. | You: custom SMTP (`docs/FIRST_ADMIN_AND_SMTP.md`). |
| 2 | **"Continue with Google" does nothing useful** | The Google provider is switched off on staging. The button shows a polite "not available" message, but it looks broken. Production state is unconfirmed. | You: either enable Google in Supabase and Google Cloud, or hide the button (setting `NEXT_PUBLIC_GOOGLE_SIGNIN=off` in Vercel). |
| 3 | **Spam and abuse limits are silently off** | The rate limiter lets everything through when the server-only Supabase key is missing from the environment. | You: confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel Production (never paste it in chat). |
| 4 | **Hosts and vendors miss requests** | Without e-mail, a new booking request, order or quotation shows up only inside their dashboard. Nobody is told. | You: SMTP + Resend with a domain; meanwhile ask hosts to check daily, and watch the admin queues. |
| 5 | **Your 20% is not collected** | No online payment: guests pay hosts and vendors directly. | You: agree monthly invoicing, or run a zero-commission pilot (`docs/SOFT_LAUNCH.md`, section 2). |
| 6 | **One admin is the bottleneck** | Every vendor, product, service, listing and review waits for approval. | You: approve daily; add a second admin later. |

## Could bite, watch in week one
| # | Risk | Note |
|---|---|---|
| 7 | Supabase free plan limits (database size, storage, project pausing after a week of inactivity, no automatic backups) | Check the production plan; take the manual backup before launch and weekly. |
| 8 | Hosting plan limits (image optimisation, bandwidth, function time) on Vercel's free tier | The home page is photo-heavy. Watch the Vercel usage page. |
| 9 | Slow first view on phones | Lab measurements before this pass: 4 to 5 seconds on a throttled phone. Real users on 4G in rural areas may see the same. |
| 10 | Empty states look thin | Few stays, products and services at first. Search by PIN shows "nothing nearby" often. Seed genuine listings before announcing. |
| 11 | Seller photos of poor quality or the wrong shape | Admin reviews listings, not pixel quality. Set a photo guide for sellers. |
| 12 | Support load lands on one e-mail address | No ticket system and no phone/WhatsApp number is set yet. |
| 13 | Wrong site address in e-mails and search results | If `NEXT_PUBLIC_SITE_URL` is not set to the live domain, links and canonical tags point to the wrong host. |
| 14 | Terms, privacy and refund wording not reviewed for a marketplace | Needs your lawyer before real money moves; fine for a request-only pilot with a clear notice. |

## Cannot happen in this release, by design
- A fake "paid" status: nothing can mark an order or booking paid without a verified provider event, and no provider is connected.
- Silent price changes after confirmation: the price and commission are locked on the booking.
- A visitor promoting themselves to admin: only the database owner can.
