# Gap analysis: PRD vs the repository (consolidated, 17 Nov 2026)

Audit basis: repository at `dea8275`, the live site, the Supabase migrations and the PRD (`Hasiru_Nidhi_Marketplace_PRD.pdf`). One pass, then built.

| PRD requirement | State at audit | Action taken |
|---|---|---|
| Host registration → email verify → profile → wizard → submit → admin approval | Built (wizard, review RPCs) | kept; `/host/register` and `/host/login` made real pages |
| Separate admin login, no public admin signup | Redirect to shared sign-in | real `/admin/login`, role re-checked after sign-in |
| PIN-code storage + validation + search + index | Column existed, **not searched or required** | search RPC, filters, homepage/Explore bar, partial index, required on submit |
| Only approved listings in search | Enforced | covered by new tests (draft/pending/rejected/suspended) |
| Commission 20 %, configurable, per-booking snapshot | **Missing** | engine, settings, immutable snapshot, audit |
| Commission ledger, payments, refunds, settlements, host earnings | **Missing** | tables, RPCs, admin + host pages |
| Booking status history | Missing | table + trigger + customer page |
| Booking details page (customer) | Missing | `/dashboard/bookings/[id]` |
| Stay completion | Status existed, nothing set it | `complete_booking` (host/admin) |
| Homepage "45 minutes" section | Stats row + hero + FAQ claims | removed everywhere; regression test |
| Gardening section + page + enquiry (PIN, date/time) + admin queue | Page + quote form existed; no homepage section | homepage section, `/gardening` services + form, `/admin/gardening` |
| Admin: hosts, host verification, customers, payments, commission, settlements | Users only | pages added |
| Payment gateway | Placeholder | provider-independent webhook foundation; **no gateway** (needs merchant account) |
| Invoices/receipts, GST | Missing | **not built** on purpose: need verified legal/tax details (PRD forbids fake GST invoices) |
| Property statuses archived / separate published flag | approved = published | not added (documented) |
| Email provider, Google OAuth, production DB install | External setup | listed as blockers |
