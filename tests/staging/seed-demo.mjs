// Seeds a small, clearly labelled DEMO catalogue on the STAGING project so a staging-backed site is not empty when someone looks at it.
// Every item says "(demo)" in its name and description. It goes through the real database functions (vendor, review, approval), never direct inserts.
// Existing test clutter is archived first. STAGING ONLY: loadEnv() refuses to run against any other project.
import fs from "node:fs";
import path from "node:path";
import { loadEnv, clients, signedIn, must, ROOT_DIR } from "./lib.mjs";

const env = loadEnv();
const c = clients(env);
const svc = c.service;
const img = (n) => fs.readFileSync(path.join(ROOT_DIR, "public/images/gardening", n));
const IMG = { marigold: "marigold-flowers-garden-karnataka.jpg", veg: "assorted-vegetables-harvest-karnataka.jpg", mixed: "mixed-vegetable-harvest-karnataka.jpg", flower: "smiling-woman-flower-bed-karnataka.jpg", leaf: "child-with-leaf-garden-karnataka.jpg" };
const NOTE = "This is a demo listing on the staging site, not a real product or provider.";

await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_products_enabled", "marketplace_orders_enabled", "marketplace_services_enabled"]);
// archive earlier test and demo items so re-running this script never duplicates
await svc.from("products").update({ status: "archived", is_featured: false }).neq("status", "archived");
await svc.from("services").update({ status: "archived", is_featured: false }).neq("status", "archived");

const admin = await signedIn(env, c, "admin@staging.test", "Staging Admin");
await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
const seller = async (k) => {
  const u = await signedIn(env, c, `seller-${k.toLowerCase()}@staging.test`, `Staging Seller ${k}`);
  const vendor = (await svc.from("vendors").select("*").eq("owner_id", u.id).single()).data;
  if (vendor.status !== "approved") throw new Error(`Seller ${k} is not onboarded: run "npm run test:staging" once first.`);
  await svc.from("vendors").update({ business_name: `${vendor.business_name.replace(/ \(demo\)$/, "")} (demo)`, description: NOTE, city: "Bengaluru", state: "Karnataka" }).eq("id", vendor.id);
  await must(await u.client.rpc("set_vendor_service_areas", { p_scope: "delivery", p_codes: ["560"] }), "delivery areas");
  return { u, vendor };
};
const cat = async (table, slug) => (await svc.from(table).select("id").eq("slug", slug).single()).data.id;

async function product(s, catSlug, name, summary, variants, photo, featured = false) {
  const pid = must(await s.u.client.rpc("save_product", { p: { category_id: await cat("product_categories", catSlug), name, summary, description: `${summary} ${NOTE}`, brand: "Demo", attributes: [{ label: "Listing", value: "Demo item" }] } }), "save_product");
  for (const [i, [vname, price, stock]] of variants.entries()) must(await s.u.client.rpc("save_product_variant", { p: { product_id: pid, sku: `DEMO-${pid.slice(0, 6)}-${i}`, name: vname, price_inr: price, initial_stock: stock } }), "variant");
  const p = `${s.vendor.id}/${pid}/demo.jpg`;
  must(await s.u.client.storage.from("product-images").upload(p, img(IMG[photo]), { contentType: "image/jpeg" }), "image");
  must(await s.u.client.rpc("register_product_image", { p_product: pid, p_path: p, p_alt: name }), "register image");
  must(await s.u.client.rpc("submit_product", { p_product: pid }), "submit");
  must(await admin.client.rpc("admin_review_product", { p_product: pid, p_decision: "approve", p_reason: null }), "approve");
  if (featured) must(await admin.client.rpc("admin_set_product_featured", { p_product: pid, p_featured: true }), "feature");
}
async function service(s, name, summary, extra, photo, featured = false) {
  const id = must(await s.u.client.rpc("save_service", { p: { category_id: await cat("service_categories", "gardening"), name, summary, description: `${summary} ${NOTE}`, duration_minutes: 60, attributes: [{ label: "Listing", value: "Demo item" }], ...extra } }), "save_service");
  const p = `${s.vendor.id}/${id}/demo.jpg`;
  must(await s.u.client.storage.from("service-images").upload(p, img(IMG[photo]), { contentType: "image/jpeg" }), "image");
  must(await s.u.client.rpc("register_service_image", { p_service: id, p_path: p, p_alt: name }), "register image");
  must(await s.u.client.rpc("submit_service", { p_service: id }), "submit");
  must(await admin.client.rpc("admin_review_service", { p_service: id, p_decision: "approve", p_reason: null }), "approve");
  if (featured) must(await admin.client.rpc("admin_set_service_featured", { p_service: id, p_featured: true }), "feature");
}

const A = await seller("A"), B = await seller("B"), C = await seller("C");
await product(A, "plants-seeds-saplings", "Tulsi (holy basil) sapling (demo)", "A healthy tulsi sapling in a small pot, ready to plant.", [["Small pot", 60, 40], ["Medium pot", 110, 25]], "leaf", true);
await product(A, "handmade-eco-friendly", "Marigold seed pack (demo)", "A pack of marigold seeds for borders and pots.", [["Pack of 50 seeds", 40, 100]], "marigold");
await product(B, "organic-fertilisers-compost", "Neem cake compost (demo)", "Organic neem cake compost for vegetable beds and pots.", [["1 kg bag", 120, 50], ["5 kg bag", 480, 20]], "mixed", true);
await product(C, "gardening-tools-accessories", "Garden hand trowel (demo)", "A sturdy steel hand trowel with a wooden handle.", [["Standard", 249, 30]], "flower");
await product(C, "farm-produce-organic-food", "Seasonal vegetable box (demo)", "A box of seasonal vegetables from a small farm.", [["Small box (about 3 kg)", 350, 15]], "veg");

// services: provider A publishes weekly hours; provider B does not (the customer states a preference and the provider confirms a time)
await must(await A.u.client.rpc("request_vendor_capability", { p_capability: "services" }).then((r) => (r.error && /already|duplicate|invalid_status/i.test(r.error.message) ? { data: null, error: null } : r)), "cap A");
await must(await B.u.client.rpc("request_vendor_capability", { p_capability: "services" }).then((r) => (r.error && /already|duplicate|invalid_status/i.test(r.error.message) ? { data: null, error: null } : r)), "cap B");
for (const s of [A, B]) {
  await must(await admin.client.rpc("admin_review_capability", { p_vendor: s.vendor.id, p_capability: "services", p_decision: "approve", p_reason: null }).then((r) => (r.error && /invalid_status|already/i.test(r.error.message) ? { data: null, error: null } : r)), "approve cap");
  await must(await s.u.client.rpc("set_vendor_service_areas", { p_scope: "service", p_codes: ["560"] }), "service areas");
}
await must(await A.u.client.rpc("set_service_availability", { p_rules: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })) }), "hours");
await service(A, "Lawn care visit (demo)", "Mowing, edging and tidying of a home lawn.", { pricing_model: "fixed", price_inr: 500, price_unit: "visit" }, "flower", true);
await service(A, "Terrace garden design (demo)", "Design and planting plan for a terrace or balcony garden.", { pricing_model: "quote", duration_minutes: 120 }, "marigold");
await service(B, "Plant health check (demo)", "A visit to check your plants for pests, soil and watering problems.", { pricing_model: "fixed", price_inr: 350, price_unit: "visit" }, "leaf");

const n = async (fn) => (await c.anon.rpc(fn, { p_limit: 50 })).data?.length ?? 0;
console.log(`Demo catalogue ready on staging: ${await n("search_products")} products, ${await n("search_services")} services visible to the public.`);
