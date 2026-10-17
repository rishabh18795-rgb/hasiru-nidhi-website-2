# Feature status

Legend: ✅ implemented and covered by automated tests · 🟢 implemented, verified by build/lint/visual checks · ⏳ needs your credentials/setup · ❌ not built

| Area | Status | Notes |
|---|---|---|
| Database schema, constraints, indexes, RLS | ✅ | 99 tests against the real migrations |
| Double-booking prevention | ✅ | Postgres exclusion constraint + RPC checks |
| Role-based access (traveller/host/admin) | ✅ | DB policies + server checks + structural tests |
| Admin cannot be self-created | ✅ | guard trigger + RPC refusal; SQL-only bootstrap |
| Listing submit → review → approve/reject/suspend | ✅ | audited, host notified |
| Booking request → host accept/decline → cancel | ✅ | in-app notifications |
| Stay search + filters + availability + pagination | ✅ | RPC `search_properties` tested |
| Public pages, SEO metadata, sitemap, robots, structured data | 🟢 | sample listings are noindex and excluded from sitemap |
| Auth: sign up/in/out, forgot/reset, profile | 🟢⏳ | code complete; needs Supabase project + Auth URL setup for live use |
| Traveller / host / admin dashboards | 🟢⏳ | needs Supabase for live data |
| Image upload (listing photos) | 🟢⏳ | storage policies in migration; needs Supabase Storage |
| Gardening quote form + private photo upload | 🟢⏳ | needs service-role key for signed uploads |
| Contact & “Book your experience” enquiries persisted | 🟢⏳ | stored in `contact_enquiries` once Supabase is connected |
| Partner applications persisted | 🟢⏳ | stored in `partner_applications` |
| WhatsApp buttons | 🟢⏳ | hidden until the official number is configured |
| E-mail notifications | ⏳ | skipped & flagged until `RESEND_API_KEY` + `EMAIL_FROM` are set |
| Online payments | ❌ | intentionally not enabled (needs merchant account); see `src/lib/payments/index.ts` |
| Reviews | ✅ | only the guest of a finished confirmed stay, once |
| Live E2E (browser) tests against Supabase | ⏳ | blocked on a Supabase project; manual checklist provided |
| Rate limiting / CAPTCHA, CSP | ❌ | recommended hardening, see README |

## Content that is placeholder and needs the owner's confirmation
* Contact address and coordinates on the Contact page/footer, package and pricing figures, FAQ/journal copy, and
  statistics (“12 acres”, “45 minutes”) carry over from the earlier marketing site and have **not** been verified.
* Photography is illustrative stock, not photographs of the real property. Replace with genuine images.
* Cancellation-policy wording is a starting framework and should be reviewed by legal counsel before commercial launch.
