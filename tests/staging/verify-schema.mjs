// Read-only checks that the staging database has the schema and policies the app expects. Staging only.
import { loadEnv, clients, check, summary, assert, eq } from "./lib.mjs";

const env = loadEnv();
const c = clients(env);
console.log("Staging schema check\n");

const TABLES = ["profiles", "properties", "bookings", "vendors", "vendor_capabilities", "vendor_documents", "vendor_service_areas", "vendor_document_requirements", "product_categories", "products", "product_variants",
  "product_images", "inventory_movements", "customer_addresses", "cart_items", "checkouts", "orders", "order_shipping", "order_items", "order_status_history", "shipments", "shipment_events", "order_requests",
  "order_disputes", "product_category_policies", "platform_settings", "audit_logs", "notifications"];

for (const t of TABLES) await check(`table ${t} exists and the public (anon) key cannot read private rows`, async () => {
  const s = await c.service.from(t).select("*", { count: "exact", head: true });
  assert(!s.error, s.error?.message);
  if (!["product_categories", "platform_settings", "product_category_policies", "amenities", "experiences", "property_categories", "properties", "property_images", "reviews", "room_types", "property_amenities", "property_experiences"].includes(t)) {
    const a = await c.anon.from(t).select("*", { count: "exact", head: true });
    assert(a.error || a.count === 0, `anon can see ${a.count} rows of ${t}`);
  }
});
await check("the six product categories exist in the agreed order", async () => {
  const { data } = await c.service.from("product_categories").select("name").order("sort_order");
  eq(data.map((r) => r.name), ["Plants, seeds and saplings", "Gardening tools and accessories", "Organic fertilisers and compost", "Handmade and eco-friendly products", "Farm produce and organic food", "Nature and lifestyle products"]);
});
await check("all four marketplace feature flags exist and are OFF (until a test turns them on)", async () => {
  const { data } = await c.service.from("platform_settings").select("key, value").like("key", "marketplace_%").order("key");
  assert(data.length === 4, `found ${data.length} flags`);
});
await check("storage buckets exist with the right visibility", async () => {
  const { data, error } = await c.service.storage.listBuckets();
  assert(!error, error?.message);
  const by = Object.fromEntries(data.map((b) => [b.id, b.public]));
  eq([by["product-images"], by["vendor-documents"], by["property-images"], by["enquiry-photos"]], [true, false, true, false]);
});
await check("anonymous users cannot call privileged functions", async () => {
  for (const fn of ["place_order", "save_product", "admin_review_product", "vendor_respond_order"]) {
    const r = await c.anon.rpc(fn, {});
    assert(r.error, `${fn} should be refused`);
  }
});
console.log("\nStaging project:", env.NEXT_PUBLIC_SUPABASE_URL);
process.exit(summary() ? 0 : 1);
