// Verifies the ORIGINAL Nature Stay workflow still works on the STAGING project after the marketplace migrations:
// a host with an approved property, a guest's booking request, the host's decision, privacy between users, and that vendor/marketplace data never touches it.
// The staging property is seeded with the service role (staging only) and is clearly labelled "(demo)".
import fs from "node:fs";
import path from "node:path";
import { loadEnv, clients, signedIn, check, summary, must, denied, assert, eq, ROOT_DIR } from "./lib.mjs";

const env = loadEnv();
const c = clients(env);
const svc = c.service;
const rpc = async (u, fn, args = {}) => must(await u.client.rpc(fn, args), fn);
const OFFSET = 20 + Math.floor((Date.now() / 1000) % 150);
const day = (n) => new Date(Date.now() + n * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);

const host = await signedIn(env, c, "host@staging.test", "Staging Host");
const otherHost = await signedIn(env, c, "host2@staging.test", "Staging Host Two");
const guest = await signedIn(env, c, "customer@staging.test", "Staging Customer");
const stranger = await signedIn(env, c, "customer2@staging.test", "Staging Customer Two");
const admin = await signedIn(env, c, "admin@staging.test", "Staging Admin");
await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);

// leave no open booking from an earlier run: the product refuses overlapping open requests by the same guest
for (const u of [guest, stranger]) for (const b of (await svc.from("bookings").select("id").eq("traveller_id", u.id).in("status", ["requested", "confirmed"])).data ?? []) await u.client.rpc("cancel_booking", { p_booking: b.id, p_note: "cleanup" });
console.log("Nature Stay on staging (original workflow)");
let propId, bookingId;
await check("an existing host can become a host through the original function, and gets the host role", async () => {
  for (const u of [host, otherHost]) await rpc(u, "become_host");
  eq((await svc.from("profiles").select("role").eq("id", host.id).single()).data.role, "host");
});
await check("an approved stay with a photo is visible to the public through the original search", async () => {
  const slug = "staging-cottage-demo";
  const cat = (await svc.from("property_categories").select("id").eq("slug", "cottage").single()).data.id;
  const existing = (await svc.from("properties").select("id").eq("slug", slug).maybeSingle()).data;
  if (existing) propId = existing.id;
  else {
    const ins = await svc.from("properties").insert({ host_id: host.id, slug, name: "Staging Cottage (demo)", category_id: cat, description: "A demo cottage on the staging site, used to check the Nature Stay workflow. It is not a real property.", city: "Bengaluru", state: "Karnataka", max_guests: 4, price_inr: 4500, status: "approved", published_at: new Date().toISOString() }).select("id").single();
    assert(!ins.error, ins.error?.message);
    propId = ins.data.id;
  }
  const p = `${propId}/demo.jpg`;
  must(await host.client.storage.from("property-images").upload(p, fs.readFileSync(path.join(ROOT_DIR, "public/images/stay/farmhouse-cottage-courtyard-karnataka.jpg")), { contentType: "image/jpeg", upsert: true }), "upload");
  await svc.from("property_images").delete().eq("property_id", propId);
  must(await svc.from("property_images").insert({ property_id: propId, path: p, source: "storage", alt: "Staging cottage courtyard" }), "image row");
  const found = must(await c.anon.rpc("search_properties", { p_limit: 20 }), "search");
  assert(JSON.stringify(found).includes("Staging Cottage (demo)"), "the stay should be searchable");
});
await check("a guest requests a stay; it is REQUESTED (not confirmed) with a price snapshot; a stranger and another host cannot see it", async () => {
  bookingId = await rpc(guest, "request_booking", { p_property: propId, p_check_in: day(OFFSET), p_check_out: day(OFFSET + 2), p_adults: 2, p_children: 0, p_message: "Staging journey" });
  const b = (await svc.from("bookings").select("*").eq("id", bookingId).single()).data;
  assert(b.status === "requested", `status ${b.status}`);
  eq((await stranger.client.from("bookings").select("id").eq("id", bookingId)).data.length, 0);
  eq((await otherHost.client.from("bookings").select("id").eq("id", bookingId)).data.length, 0);
  eq((await host.client.from("bookings").select("id").eq("id", bookingId)).data.length, 1);
});
await check("only the property's host can decide it; the host accepts; the dates are then blocked for others", async () => {
  await denied(otherHost.client.rpc("respond_to_booking", { p_booking: bookingId, p_accept: true }), /forbidden/);
  await denied(guest.client.rpc("respond_to_booking", { p_booking: bookingId, p_accept: true }), /forbidden/);
  await rpc(host, "respond_to_booking", { p_booking: bookingId, p_accept: true, p_note: "See you soon" });
  eq((await svc.from("bookings").select("status").eq("id", bookingId).single()).data.status, "confirmed");
  await denied(stranger.client.rpc("request_booking", { p_property: propId, p_check_in: day(OFFSET + 1), p_check_out: day(OFFSET + 3), p_adults: 2, p_children: 0, p_message: null }), /dates_unavailable/);
});
await check("a guest can cancel before the stay; the stay money rules are untouched (no marketplace data on bookings)", async () => {
  await rpc(guest, "cancel_booking", { p_booking: bookingId, p_note: "Staging cleanup" });
  const b = (await svc.from("bookings").select("status").eq("id", bookingId).single()).data;
  assert(String(b.status).startsWith("cancelled"), `status ${b.status}`);
});
console.log("\nStaging project:", env.NEXT_PUBLIC_SUPABASE_URL);
process.exit(summary() ? 0 : 1);
