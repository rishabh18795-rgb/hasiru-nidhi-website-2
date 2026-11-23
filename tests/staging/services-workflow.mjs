// End-to-end verification of the Services module against the STAGING Supabase project: real Auth sessions, PostgREST, Storage and RLS.
// Provider onboarding, listing review, public visibility, fixed-price and quotation flows, appointments, privacy and isolation.
import fs from "node:fs";
import path from "node:path";
import { loadEnv, clients, signedIn, check, summary, must, denied, assert, eq, ROOT_DIR } from "./lib.mjs";

const env = loadEnv();
const c = clients(env);
const svc = c.service;
const run = Date.now().toString(36);
console.log(`Staging services run ${run}\n`);

const JPG = fs.readFileSync(path.join(ROOT_DIR, "public/images/gardening/marigold-flowers-garden-karnataka.jpg"));
const rpc = async (u, fn, args = {}) => must(await u.client.rpc(fn, args), fn);
const istDay = (n) => new Date(Date.now() + n * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
const at = (n, hhmm) => `${istDay(n)}T${hhmm}:00+05:30`;

const admin = await signedIn(env, c, "admin@staging.test", "Staging Admin");
await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
const prov = await signedIn(env, c, "seller-a@staging.test", "Staging Seller A");
const other = await signedIn(env, c, "seller-b@staging.test", "Staging Seller B");
const alice = await signedIn(env, c, "customer@staging.test", "Staging Customer");
const bob = await signedIn(env, c, "customer2@staging.test", "Staging Customer Two");
await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_services_enabled"]);

const vendorOf = async (u) => (await svc.from("vendors").select("*").eq("owner_id", u.id).maybeSingle()).data;
let vendor;
const gardening = (await svc.from("service_categories").select("id").eq("slug", "gardening").single()).data.id;

console.log("Provider onboarding (services capability is approved separately)");
await check("provider requests the services capability; an admin approves it; service areas are set", async () => {
  vendor = await vendorOf(prov);
  assert(vendor && vendor.status === "approved", "seller A should already be an approved vendor from the Phase 3 run (run `npm run test:staging` first)");
  const cap = (await svc.from("vendor_capabilities").select("status").eq("vendor_id", vendor.id).eq("capability", "services").maybeSingle()).data;
  if (!cap) await rpc(prov, "request_vendor_capability", { p_capability: "services" });
  if ((cap?.status ?? "pending") !== "approved") await rpc(admin, "admin_review_capability", { p_vendor: vendor.id, p_capability: "services", p_decision: "approve", p_reason: null });
  await rpc(prov, "set_vendor_service_areas", { p_scope: "service", p_codes: ["560"] });
  eq((await svc.from("vendor_capabilities").select("status").eq("vendor_id", vendor.id).eq("capability", "services").single()).data.status, "approved");
});
await check("a customer or another provider cannot create or touch this provider's listings", async () => {
  await denied(alice.client.rpc("save_service", { p: { category_id: gardening, name: "Nope", pricing_model: "quote" } }), /not_found|capability_not_approved/);
  await denied(other.client.rpc("save_service", { p: { category_id: gardening, name: "Nope", pricing_model: "quote" } }), /not_found|capability_not_approved/);
});

console.log("\nListings: photos, review, public visibility");
const listing = {};
await check("provider creates a fixed-price and a quotation listing, uploads a photo to their own folder only, submits both", async () => {
  const mk = async (name, extra) => (await rpc(prov, "save_service", { p: { category_id: gardening, name: `${name} ${run}`, summary: "Staging test service.", description: "A staging test service listing with a description longer than thirty characters.", duration_minutes: 60, ...extra } }));
  listing.fixed = await mk("Lawn care visit", { pricing_model: "fixed", price_inr: 500, price_unit: "visit" });
  listing.quote = await mk("Garden design", { pricing_model: "quote" });
  for (const id of [listing.fixed, listing.quote]) {
    const p = `${vendor.id}/${id}/photo-${run}.jpg`;
    must(await prov.client.storage.from("service-images").upload(p, JPG, { contentType: "image/jpeg" }), "own upload");
    await rpc(prov, "register_service_image", { p_service: id, p_path: p, p_alt: "Garden" });
    await rpc(prov, "submit_service", { p_service: id });
  }
  const steal = await other.client.storage.from("service-images").upload(`${vendor.id}/${listing.fixed}/steal-${run}.jpg`, JPG, { contentType: "image/jpeg" });
  assert(steal.error, "another provider must not write into this provider's folder");
});
await check("nothing is public before approval; the provider cannot approve their own listing; an admin can", async () => {
  eq((await c.anon.rpc("search_services", { p_query: run })).data.length, 0, "pending listings are hidden");
  await denied(prov.client.rpc("admin_review_service", { p_service: listing.fixed, p_decision: "approve" }), /forbidden/);
  for (const id of [listing.fixed, listing.quote]) await rpc(admin, "admin_review_service", { p_service: id, p_decision: "approve", p_reason: null });
});
await check("anonymous visitors see both listings through the public function only, with the right prices, and cannot read the tables", async () => {
  const rows = must(await c.anon.rpc("search_services", { p_query: run }), "search");
  eq(rows.length, 2);
  const fx = rows.find((r) => r.pricing_model === "fixed");
  eq([Number(fx.price_inr), rows.find((r) => r.pricing_model === "quote").price_inr], [500, null]);
  const direct = await c.anon.from("services").select("id");
  assert(direct.error || direct.data.length === 0, "anon must not read the services table");
  const pub = must(await c.anon.rpc("get_service_public", { p_slug: fx.slug }), "detail");
  assert(!JSON.stringify(pub).match(/contact_email|contact_phone|owner_id/), "no private provider data on the public page");
  eq(must(await c.anon.rpc("check_service_coverage", { p_service: listing.fixed, p_pin: "560078" })), "yes");
  eq(must(await c.anon.rpc("check_service_coverage", { p_service: listing.fixed, p_pin: "110001" })), "no");
});

console.log("\nAvailability and the fixed-price flow");
await rpc(prov, "set_service_availability", { p_rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })) });
let r1;
await check("published hours produce real slots; a customer requests one; the request is unpaid and the provider cannot see phone or address yet", async () => {
  const slots = must(await c.anon.rpc("get_service_slots", { p_service: listing.fixed, p_from: istDay(4), p_days: 1 }), "slots");
  eq(slots.length, 8);
  r1 = await rpc(alice, "request_service", { p: { service_id: listing.fixed, quantity: 2, customer_name: "Staging Customer", phone: "9876500000", address_line: "12 Rose Street", city: "Bengaluru", pin: "560078", details: "Trim the lawn.", preferred_start: slots[1].slot_start }, p_key: `k-${run}-1` });
  const row = (await svc.from("service_requests").select("*").eq("id", r1).single()).data;
  eq([row.status, row.payment_status, Number(row.agreed_total_inr)], ["submitted", "unpaid", 1000]);
  eq((await prov.client.from("service_request_contact").select("*").eq("request_id", r1)).data.length, 0, "provider must not see contact details before accepting");
  eq(must(await alice.client.rpc("request_service", { p: { service_id: listing.fixed, quantity: 2, customer_name: "Staging Customer", phone: "9876500000", address_line: "12 Rose Street", city: "Bengaluru", pin: "560078", details: "Trim the lawn.", preferred_start: slots[1].slot_start }, p_key: `k-${run}-1` })), r1, "a retried request is idempotent");
});
await check("another customer and another provider cannot see or act on the request", async () => {
  eq((await bob.client.from("service_requests").select("id").eq("id", r1)).data.length, 0);
  eq((await other.client.from("service_requests").select("id").eq("id", r1)).data.length, 0);
  await denied(other.client.rpc("provider_respond_service_request", { p_request: r1, p_decision: "accept" }), /not_found|capability_not_approved/);
  await denied(bob.client.rpc("cancel_service_request", { p_request: r1 }), /not_found/);
});
await check("the provider accepts: the slot is booked, contact details appear, it is taken from the next customer, then started and completed", async () => {
  await rpc(prov, "provider_respond_service_request", { p_request: r1, p_decision: "accept" });
  eq((await prov.client.from("service_request_contact").select("phone").eq("request_id", r1)).data.length, 1);
  const appt = (await svc.from("service_appointments").select("*").eq("request_id", r1).eq("status", "confirmed")).data;
  eq(appt.length, 1);
  await denied(bob.client.rpc("request_service", { p: { service_id: listing.fixed, quantity: 1, customer_name: "Bob", phone: "9876511111", address_line: "5 Oak Road", city: "Bengaluru", pin: "560078", preferred_start: appt[0].starts_at }, p_key: `k-${run}-2` }), /slot_unavailable/);
  await rpc(prov, "provider_start_service", { p_request: r1 });
  await rpc(prov, "provider_complete_service", { p_request: r1 });
  const row = (await svc.from("service_requests").select("status, payment_status").eq("id", r1).single()).data;
  eq([row.status, row.payment_status], ["completed", "unpaid"], "completed work is still never shown as paid");
  const hist = (await alice.client.from("service_request_history").select("to_status").eq("request_id", r1).order("id")).data.map((h) => h.to_status);
  eq(hist, ["submitted", "accepted", "in_progress", "completed"]);
});

console.log("\nQuotation flow");
let r2, q2;
await check("customer asks for a quotation; the provider cannot simply accept; sends a quotation; the customer accepts and the agreed total is the quote", async () => {
  r2 = await rpc(bob, "request_service", { p: { service_id: listing.quote, customer_name: "Bob", phone: "9876511111", address_line: "5 Oak Road", city: "Bengaluru", pin: "560001", details: "Redesign a small terrace garden." }, p_key: `k-${run}-3` });
  await denied(prov.client.rpc("provider_respond_service_request", { p_request: r2, p_decision: "accept" }), /quotation_required/);
  q2 = await rpc(prov, "provider_send_quotation", { p_request: r2, p: { amount_inr: 9500.5, description: "Design, plants and one visit.", valid_until: istDay(10), proposed_start: at(5, "11:00"), proposed_duration_minutes: 120 } });
  eq((await bob.client.from("service_quotations").select("id").eq("request_id", r2)).data.length, 1);
  eq((await alice.client.from("service_quotations").select("id").eq("request_id", r2)).data.length, 0, "other customers never see quotations");
  await denied(prov.client.rpc("decide_quotation", { p_quotation: q2, p_decision: "accept" }), /not_found/);
  await rpc(bob, "decide_quotation", { p_quotation: q2, p_decision: "accept", p_note: "Looks good" });
  const row = (await svc.from("service_requests").select("status, agreed_total_inr, payment_status").eq("id", r2).single()).data;
  eq([row.status, Number(row.agreed_total_inr), row.payment_status], ["accepted", 9500.5, "unpaid"]);
  eq((await svc.from("service_appointments").select("id").eq("request_id", r2).eq("status", "confirmed")).data.length, 1);
});
await check("an administrator can cancel an open request with a reason; direct writes to request tables are refused for everyone else", async () => {
  await rpc(admin, "admin_cancel_service_request", { p_request: r2, p_reason: "Staging cleanup" });
  eq((await svc.from("service_requests").select("status").eq("id", r2).single()).data.status, "cancelled");
  for (const u of [alice, prov]) {
    const w = await u.client.from("service_requests").update({ status: "completed", payment_status: "paid" }).eq("id", r1).select();
    assert(w.error || w.data.length === 0, "direct update must not work");
  }
});

// leave staging tidy: archive the listings created by this run and clear the provider's weekly hours
for (const id of [listing.fixed, listing.quote]) await svc.from("services").update({ status: "archived" }).eq("id", id);
console.log("\nStaging project:", env.NEXT_PUBLIC_SUPABASE_URL);
process.exit(summary() ? 0 : 1);
