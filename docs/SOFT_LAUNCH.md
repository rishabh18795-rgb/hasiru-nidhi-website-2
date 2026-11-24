# Soft launch without online payments: configuration report, commission review and checklist

Owner decisions of 24 Nov 2026: platform commission 20 percent; official e-mail hasirunidhiofficial@gmail.com; Razorpay to be integrated and tested later by the owner; limited soft launch with no online payment.
Branch `marketplace/develop`. **Production has not been touched.** Nothing here is applied to production until the owner approves.

## 1. What is configured (staging)

| Item | State | How verified |
|---|---|---|
| Product commission | **20 %**, whole vertical, recorded with an approval note | `node tests/staging/configure-business.mjs` reads it back |
| Service commission | **20 %**, whole vertical | same |
| Per-category overrides | Still possible (Admin, Marketplace commission). A category rate overrides the vertical rate; history is append-only | DB tests (`tests/db/commission.test.ts`) |
| Stay commission | `commission_rate_percent` = **20** (separate setting, unchanged) | script reads it back |
| Official e-mail | Footer, Contact page, Privacy, Terms, FAQ, structured data and the admin Support-email setting all show the address. It is the built-in default in `src/lib/site.ts`; `NEXT_PUBLIC_CONTACT_EMAIL` still overrides it | 10 browser checks on the staging build (desktop and mobile) |
| Online payment | Not available. No provider, no fake credentials; the webhook answers 503; every order and service request reads UNPAID | code (`getPaymentProvider()` returns null) and the staging script |
| Deductions | **None.** No order, order line or service request has any commission column. A new test fails if one is ever added | `tests/db/commission.test.ts` |

For production the same two things are needed, each only after approval: record the rates in Admin, Marketplace commission (note: "Owner decision 24 Nov 2026"), and confirm Admin, Settings, Support email.

## 2. How commission works today, by vertical

**Stays: implemented and tested.**
- Rate: 20 % (`platform_settings.commission_rate_percent`), applied to the accommodation amount (stay plus extra-guest charges). The base can be switched to include the cleaning fee.
- When a booking is confirmed the rate, base, commission and host share are stored on the booking and can never change afterwards. An append-only ledger entry is written once. Cancellation and refunds write proportional reversals. Commission plus host share always equals the base exactly.
- Settlement to a host needs the booking completed and a payment recorded by an administrator.
- Gaps: it accrues at confirmation, not at payment. With no online payment, the guest pays the host directly, so the platform has **no automatic way to collect its 20 %**. GST is not modelled anywhere in the stay price or the commission.

**Products (Shop): rate only.** The 20 % is stored, but nothing calculates, accrues or deducts it. Orders carry no commission fields.

**Services: rate only.** Same as products. Requests, quotations and appointments exist; no commission is calculated.

### Decisions needed before any deduction is switched on
1. **Base:** item value after discounts, excluding shipping and GST? (Recommended.) Services: the accepted quotation amount.
2. **GST on the commission:** commission is normally a taxable service from the platform to the vendor. At 18 % GST the vendor's real cost is 20 % x 1.18 = **23.6 % of the base**. Decide whether 20 % is exclusive or inclusive of GST, and say so in the vendor agreement.
3. **Payment gateway fee:** who bears Razorpay's fee (vendor, platform or customer)?
4. **Timing:** accrue when the order is delivered/service completed and paid, reverse proportionally on returns and refunds (mirrors the Stay design).
5. **Off-platform payment:** while payment is arranged directly, how is the 20 % collected? Options: monthly invoice to the vendor or host on recorded transactions, or run the soft launch as a zero-commission pilot. Without one of these the soft launch earns nothing.

Build once decided: a tested commission calculator and append-only ledger for orders and service requests (the same pattern as Stays), shown in Admin, Marketplace finance. Not started, on purpose: you asked for review and tests before activation.

## 3. Remaining GST, invoice, refund and legal items

I am not a tax or legal adviser. These are the items to take to your CA and lawyer; none is decided in code.

**GST and tax**
- Is Hasiru Nidhi Horizons Pvt Ltd GST-registered, and on which turnover basis? Platforms that sell vendors' goods or services can be treated as e-commerce operators, which brings registration, tax collection at source (GST) and TDS on payouts into scope.
- GST on the 20 % commission, and invoices for it (a tax invoice from the platform to each vendor or host).
- GST on stays and services sold through the platform: who is liable, and the rate that applies to the tariff.
- Invoices: no invoice or credit-note generation exists. Needed per order and per commission charge once money moves.

**Refunds and payouts**
- No refund engine, payout or settlement execution exists. Today the cancellation page honestly says refunds are settled directly with the host.
- Razorpay: merchant KYC, API keys and webhook secret go in server-only environment variables entered by you; then an adapter, then tested success, failure and refund events. Until then everything stays unpaid.

**Legal and compliance**
- Terms and Privacy pages need review for a marketplace (customer terms, vendor/host agreement including commission, payout timing, returns, disputes), and for India's data protection law (consent, notice, grievance contact).
- E-commerce rules: grievance officer name and contact, seller details on listings, return and refund information, price transparency, country of origin.
- Product-specific: food and organic produce usually need food-safety licensing from the seller; packaged goods have labelling rules. Plants and seeds may have their own rules. Decide which categories are allowed in the soft launch.
- Stays: any local homestay or tourism registration the hosts need. Hosts are responsible, but you may want to ask for it at onboarding.

## 4. Soft-launch checklist

**Scope recommended for the first limited release**
- Nature Stay and Explore Stays: booking requests, guest pays the host directly (as today).
- Vendor registration: ON, every vendor approved by hand.
- Products: ON as a browsable catalogue. **Orders OFF**, so there is no cart or checkout and nothing payment-dependent.
- Services: ON as requests and quotations, with the "arranged directly, nothing charged here" wording already shown. Switch OFF if you want zero payment-adjacent features.
- Reviews: follow the flags; they need a completed order or service.

**Before production is touched (needs your explicit approval)**
- [ ] Regenerate the staging service key (it appeared in screenshots).
- [ ] Approve the plan in `docs/LAUNCH_CHECKLIST.md`: back up production, run M1 to M7 in order, merge `marketplace/develop` into `main`.
- [ ] Production environment variables in Vercel: site URL, Supabase keys (production project), optional contact phone and WhatsApp.
- [ ] Create the first administrator: sign up with a mailbox you control, then run `supabase/scripts/create_first_admin.sql`. I need your confirmation of the exact account.
- [ ] Auth e-mail: Supabase's built-in sender is limited to a few messages an hour, which breaks sign-up verification for more than a handful of users. Set custom SMTP in Supabase (you enter the password yourself). Gmail SMTP with an app password works for a small pilot; a domain mailbox with Resend is the proper setup. A Gmail address cannot be a verified Resend sender, so admin notification e-mails need a domain. Until then notifications are in-app only.
- [ ] Supabase Authentication, URL Configuration: Site URL and redirect URLs for the live domain.
- [ ] Record the 20 % rates and the Support email in Admin on production.

**Content and people**
- [ ] A real business phone and WhatsApp number (still empty; the contact page works with e-mail and address only).
- [ ] Genuine vendors, products and providers added and approved; no demo data exists in production by design.
- [ ] Vendor and host agreement signed, including the 20 % and how it is collected (section 2, decision 5).
- [ ] CA and lawyer sign-off on section 3 items marked for the launch scope.

**Go-live steps** (in this order, checking the audit log after each)
1. Flags: vendor registration, then Products, then Services. Orders stay OFF.
2. Test with real mailboxes you control: sign up, verify, sign in, reset password, request a stay, apply as a vendor, approve.
3. Announce to the small invited group only.

**Switch-off and recovery:** every flag turns a module off at once with no deploy; website roll-back is Vercel, Deployments, Promote the previous deployment; database roll-back only before real data exists (see `docs/LAUNCH_CHECKLIST.md`, section 4).

## 5. Not blocking the soft launch, still open
- Mobile lab LCP above 4 s on home, stay and product pages.
- Two possible contrast findings on `/experiences` and `/gardening-landscaping` that a targeted check did not reproduce.
- Logo file has a white background.
- No support-ticket system, no calendar sync, no invoices.
