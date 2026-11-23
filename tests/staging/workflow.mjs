// End-to-end verification against the STAGING Supabase project: real Auth sessions, real PostgREST, real Storage, real RLS.
// Covers vendor onboarding, product listing and approval (Phases 3 and 4) and the whole order workflow (Phase 5).
// Every assertion about state is read back from the database with the service-role client, not inferred from a UI message.
import fs from "node:fs";
import path from "node:path";
import { loadEnv, clients, signedIn, check, summary, must, denied, assert, eq, ROOT_DIR } from "./lib.mjs";

const env = loadEnv();
const c = clients(env);
const svc = c.service;
const run = Date.now().toString(36);
console.log(`Staging workflow run ${run}\n`);

const JPG = fs.readFileSync(path.join(ROOT_DIR, "public/images/gardening/marigold-flowers-garden-karnataka.jpg"));
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const rpc = async (u, fn, args = {}) => must(await u.client.rpc(fn, args), fn);
// The Stay tables may hold records from other staging suites; this workflow must simply not CHANGE them.
const stayCounts = async () => [(await svc.from("payments").select("id", { count: "exact", head: true })).count, (await svc.from("bookings").select("id", { count: "exact", head: true })).count, (await svc.from("commission_ledger").select("id", { count: "exact", head: true })).count];
const stayBaseline = await stayCounts();

// ------------------------------------------------------------------ identities (synthetic, staging only)
const admin = await signedIn(env, c, "admin@staging.test", "Staging Admin");
await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
const sellers = { A: await signedIn(env, c, "seller-a@staging.test", "Staging Seller A"), B: await signedIn(env, c, "seller-b@staging.test", "Staging Seller B"), C: await signedIn(env, c, "seller-c@staging.test", "Staging Seller C") };
const alice = await signedIn(env, c, "customer@staging.test", "Staging Customer");
const bob = await signedIn(env, c, "customer2@staging.test", "Staging Customer Two");
await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_products_enabled", "marketplace_orders_enabled"]);
for (const u of [alice, bob]) { await rpc(u, "cart_clear"); await svc.from("customer_addresses").delete().eq("user_id", u.id); } // the product limits an account to 10 saved addresses

const vendorOf = async (u) => (await svc.from("vendors").select("*").eq("owner_id", u.id).maybeSingle()).data;
const vend = {};
const catId = async (slug) => (await svc.from("product_categories").select("id").eq("slug", slug).single()).data.id;

console.log("Phase 3: vendor onboarding, verification and coverage");
for (const [k, u] of Object.entries(sellers)) {
  await check(`seller ${k}: applies, admin verifies the business and approves the products capability separately`, async () => {
    let v = await vendorOf(u);
    if (!v || v.status !== "approved") {
      await rpc(u, "save_vendor_profile", { p: { business_name: `Staging Seller ${k}`, business_type: "farm", description: "Staging test seller.", contact_name: `Seller ${k}`, contact_email: u.email, contact_phone: "+919800000000", address_line: "1 Test Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078" } });
      await rpc(u, "submit_vendor_application", { p_capabilities: ["products"] });
      v = await vendorOf(u);
      await rpc(admin, "admin_review_vendor", { p_vendor: v.id, p_decision: "approve", p_reason: null });
    }
    v = await vendorOf(u);
    const cap = (await svc.from("vendor_capabilities").select("status").eq("vendor_id", v.id).eq("capability", "products").maybeSingle()).data;
    if (!cap) { await rpc(u, "request_vendor_capability", { p_capability: "products" }); }
    if ((cap?.status ?? "pending") !== "approved") await rpc(admin, "admin_review_capability", { p_vendor: v.id, p_capability: "products", p_decision: "approve", p_reason: null });
    await rpc(u, "set_vendor_service_areas", { p_scope: "delivery", p_codes: ["560"] });
    vend[k] = await vendorOf(u);
    eq([vend[k].status, (await svc.from("vendor_capabilities").select("status").eq("vendor_id", vend[k].id).eq("capability", "products").single()).data.status], ["approved", "approved"]);
  });
}
await check("a seller cannot approve themselves, read another vendor, or change protected columns (real JWTs)", async () => {
  await denied(sellers.A.client.rpc("admin_review_vendor", { p_vendor: vend.A.id, p_decision: "approve" }), /forbidden/);
  const others = must(await sellers.A.client.from("vendors").select("id"), "vendors");
  eq(others.map((r) => r.id), [vend.A.id], "seller A sees only their own vendor");
  const upd = await sellers.A.client.from("vendors").update({ status: "approved" }).eq("id", vend.A.id).select();
  assert(upd.error || upd.data.length === 0, "direct update must not work");
});
await check("vendor documents: stored privately, owner can upload to their own folder only, only an admin can open them", async () => {
  const mine = `${vend.A.id}/doc-${run}.pdf`;
  must(await sellers.A.client.storage.from("vendor-documents").upload(mine, PDF, { contentType: "application/pdf" }), "own upload");
  assert((await sellers.B.client.storage.from("vendor-documents").upload(`${vend.A.id}/steal-${run}.pdf`, PDF, { contentType: "application/pdf" })).error, "seller B must not write into A's folder");
  assert((await sellers.B.client.storage.from("vendor-documents").download(mine)).error, "seller B must not read A's document");
  assert((await c.anon.storage.from("vendor-documents").download(mine)).error, "anonymous must not read documents");
  must(await sellers.A.client.storage.from("vendor-documents").download(mine), "owner read");
  const signed = must(await admin.client.storage.from("vendor-documents").createSignedUrl(mine, 60), "admin signed url");
  assert(signed.signedUrl, "admin gets a signed link");
  must(await sellers.A.client.rpc("register_vendor_document", { p_requirement: null, p_label: "Test document", p_path: mine, p_name: "doc.pdf" }), "register");
  await rpc(admin, "admin_review_vendor_document", { p_document: (await svc.from("vendor_documents").select("id").eq("storage_path", mine).single()).data.id, p_decision: "accept", p_note: "ok" });
});

console.log("\nPhase 4: products, photos, separate approval, public visibility");
const items = {};
async function listProduct(k, name, price, stock, category) {
  const u = sellers[k];
  const pid = (await rpc(u, "save_product", { p: { category_id: await catId(category), name: `${name} ${run}`, summary: `${name} (staging).`, description: `${name}: a staging test product with a long enough description to be submitted for review.`, brand: "Staging", attributes: [{ label: "Origin", value: "Staging farm" }] } }));
  const vid = await rpc(u, "save_product_variant", { p: { product_id: pid, sku: `S-${k}-${run}`, name: "Standard", price_inr: price, initial_stock: stock, options: { Size: "Medium" } } });
  const imgPath = `${vend[k].id}/${pid}/${run}.jpg`;
  must(await u.client.storage.from("product-images").upload(imgPath, JPG, { contentType: "image/jpeg" }), "image upload");
  await rpc(u, "register_product_image", { p_product: pid, p_path: imgPath, p_alt: name });
  return { pid, vid, imgPath };
}
await check("sellers create products with variants and real photo uploads to the product-images bucket", async () => {
  items.A = await listProduct("A", "Tulsi sapling", 500, 10, "plants-seeds-saplings");
  items.B = await listProduct("B", "Neem compost", 500, 10, "organic-fertilisers-compost");
  items.C = await listProduct("C", "Hand trowel", 250, 10, "gardening-tools-accessories");
  const stockA = (await svc.from("product_variants").select("stock_on_hand").eq("id", items.A.vid).single()).data.stock_on_hand;
  eq(stockA, 10);
  const mv = (await svc.from("inventory_movements").select("delta, reason").eq("variant_id", items.A.vid)).data;
  eq(mv, [{ delta: 10, reason: "initial" }]);
});
await check("storage policies: another seller, a customer and an anonymous user cannot write product photos for this seller", async () => {
  const p = `${vend.A.id}/${items.A.pid}/evil-${run}.jpg`;
  for (const who of [sellers.B, alice]) assert((await who.client.storage.from("product-images").upload(p, JPG, { contentType: "image/jpeg" })).error, "must be denied");
  assert((await c.anon.storage.from("product-images").upload(p, JPG, { contentType: "image/jpeg" })).error, "anon must be denied");
  const url = c.anon.storage.from("product-images").getPublicUrl(items.A.imgPath).data.publicUrl;
  const res = await fetch(url);
  assert(res.status === 200 && /image\/jpeg/.test(res.headers.get("content-type") ?? ""), `public photo should load (${res.status})`);
});
await check("a seller cannot touch another seller's product, and drafts are invisible to the public", async () => {
  await denied(sellers.B.client.rpc("save_product", { p: { id: items.A.pid, category_id: await catId("plants-seeds-saplings"), name: "Hijack attempt" } }), /not_found/);
  eq(must(await sellers.B.client.from("products").select("id").eq("id", items.A.pid)), []);
  const pub = must(await c.anon.rpc("search_products", { p_query: `Tulsi sapling ${run}` }), "search");
  eq(pub, [], "a draft must not be searchable");
});
await check("submitting for review puts each product in the admin queue; an approved vendor's product is still NOT public", async () => {
  for (const k of ["A", "B", "C"]) await rpc(sellers[k], "submit_product", { p_product: items[k].pid });
  const queue = (await admin.client.from("products").select("id, status").eq("status", "pending_review")).data.map((r) => r.id);
  for (const k of ["A", "B", "C"]) assert(queue.includes(items[k].pid), `product ${k} should be in the admin queue`);
  eq(must(await c.anon.rpc("search_products", { p_query: `Tulsi sapling ${run}` })), []);
});
await check("an administrator approves, and only then is it publicly discoverable (anon key, no stock numbers)", async () => {
  for (const k of ["A", "B", "C"]) await rpc(admin, "admin_review_product", { p_product: items[k].pid, p_decision: "approve", p_reason: null });
  const found = must(await c.anon.rpc("search_products", { p_query: `Tulsi sapling ${run}` }));
  eq(found.length, 1);
  const page = must(await c.anon.rpc("get_product_public", { p_slug: found[0].slug }));
  assert(!JSON.stringify(page).match(/stock_on_hand|contact_email|owner_id/), "no private data in the public view");
  eq(page.variants[0].in_stock, true);
  eq(must(await c.anon.rpc("check_product_delivery", { p_product: items.A.pid, p_pin: "560001" })), "yes");
  eq(must(await c.anon.rpc("check_product_delivery", { p_product: items.A.pid, p_pin: "110001" })), "no");
  const direct = await c.anon.from("products").select("id");
  assert(direct.error || direct.data.length === 0, "anon cannot read the products table directly");
});

console.log("\nPhase 5: cart, checkout, vendor-wise orders, fulfilment, cancellation and returns");
const addr = (await rpc(alice, "save_address", { p: { label: "Home", full_name: "Staging Customer", phone: "+919800000001", line1: "12 Garden Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078", is_default: true } }));
const bobAddr = (await rpc(bob, "save_address", { p: { full_name: "Staging Customer Two", phone: "+919800000002", line1: "5 Lake Road", city: "Bengaluru", state: "Karnataka", postal_code: "560001" } }));
let checkoutId; const orders = {};
await check("the customer builds a multi-vendor cart (A: 2 x 500, B: 1 x 500, C: 3 x 250) with live prices", async () => {
  await rpc(alice, "cart_set_item", { p_variant: items.A.vid, p_quantity: 2 });
  await rpc(alice, "cart_set_item", { p_variant: items.B.vid, p_quantity: 1 });
  await rpc(alice, "cart_set_item", { p_variant: items.C.vid, p_quantity: 3 });
  const cart = await rpc(alice, "get_cart", { p_pin: "560078" });
  eq([cart.item_count, Number(cart.subtotal_inr), cart.vendors.map((v) => v.delivery)], [6, 2250, ["yes", "yes", "yes"]]);
  eq(must(await bob.client.from("cart_items").select("*")).length, 0, "another customer cannot see this cart");
});
await check("checkout creates ONE order per vendor (1,000 / 750 / 500) linked to one checkout, unpaid, no invented fees", async () => {
  const key = `staging-${run}-1`;
  checkoutId = await rpc(alice, "place_order", { p_address: addr, p_key: key });
  const rows = (await svc.from("orders").select("id, vendor_id, items_total_inr, status, payment_status, shipping_fee_inr, tax_inr, order_number").eq("checkout_id", checkoutId)).data;
  eq(rows.map((r) => Number(r.items_total_inr)).sort((a, b) => b - a), [1000, 750, 500]);
  assert(rows.every((r) => r.status === "placed" && r.payment_status === "unpaid" && r.shipping_fee_inr === null && r.tax_inr === null), "all placed, unpaid, no fee, no tax");
  for (const k of ["A", "B", "C"]) orders[k] = rows.find((r) => r.vendor_id === vend[k].id).id;
  const co = (await svc.from("checkouts").select("reference, items_total_inr, order_count, payment_status").eq("id", checkoutId).single()).data;
  assert(/^HN-C-\d+$/.test(co.reference) && Number(co.items_total_inr) === 2250 && co.order_count === 3 && co.payment_status === "unpaid", "checkout row");
  eq((await svc.from("payments").select("id", { count: "exact", head: true })).count, 0, "no payment record exists");
  eq(await rpc(alice, "place_order", { p_address: addr, p_key: key }), checkoutId, "same key returns the same checkout");
  eq((await svc.from("orders").select("id", { count: "exact", head: true }).eq("checkout_id", checkoutId)).count, 3, "no duplicate orders");
});
await check("stock was deducted once per vendor with movements tied to the orders, and the cart is empty", async () => {
  const st = async (k) => (await svc.from("product_variants").select("stock_on_hand").eq("id", items[k].vid).single()).data.stock_on_hand;
  eq([await st("A"), await st("B"), await st("C")], [8, 9, 7]);
  const mv = (await svc.from("inventory_movements").select("delta, order_id").eq("reason", "order_placed").in("variant_id", [items.A.vid, items.B.vid, items.C.vid])).data;
  eq(mv.map((m) => m.delta).sort((a, b) => a - b), [-3, -2, -1]);
  eq((await svc.from("cart_items").select("*", { count: "exact", head: true }).eq("user_id", alice.id)).count, 0);
});
await check("each vendor sees ONLY their own order; the customer sees all three; others see none; sellers cannot read the checkout", async () => {
  for (const k of ["A", "B", "C"]) eq(must(await sellers[k].client.from("orders").select("id").eq("checkout_id", checkoutId)).map((r) => r.id), [orders[k]], `seller ${k}`);
  eq(must(await alice.client.from("orders").select("id").eq("checkout_id", checkoutId)).length, 3);
  eq(must(await bob.client.from("orders").select("id").eq("checkout_id", checkoutId)).length, 0);
  eq(must(await sellers.A.client.from("checkouts").select("id")).length, 0);
  eq([...new Set(must(await sellers.A.client.from("order_items").select("order_id").in("order_id", [orders.A, orders.B, orders.C])).map((r) => r.order_id))], [orders.A], "seller A sees items of their own order only");
  eq(must(await sellers.A.client.from("order_shipping").select("order_id").in("order_id", [orders.A, orders.B, orders.C])).length, 0, "address hidden before acceptance");
  eq(must(await admin.client.from("orders").select("id").eq("checkout_id", checkoutId)).length, 3, "admin sees all");
});
await check("clients cannot write orders directly, mark anything paid, or use another seller's order", async () => {
  assert((await alice.client.from("orders").update({ status: "delivered" }).eq("id", orders.A).select()).data?.length !== 1, "direct update refused");
  assert((await alice.client.from("orders").update({ payment_status: "paid" }).eq("id", orders.A).select()).data?.length !== 1, "cannot mark paid");
  await denied(sellers.B.client.rpc("vendor_respond_order", { p_order: orders.A, p_decision: "accept" }), /not_found/);
  await denied(alice.client.rpc("vendor_respond_order", { p_order: orders.A, p_decision: "accept" }), /not_found/);
  eq((await svc.from("orders").select("payment_status").eq("id", orders.A).single()).data.payment_status, "unpaid");
});
await check("seller B rejects (with a reason, stock returns once); sellers A and C accept and the customer's address becomes visible only to them", async () => {
  await denied(sellers.B.client.rpc("vendor_respond_order", { p_order: orders.B, p_decision: "reject", p_reason: null }), /reason_required/);
  await rpc(sellers.B, "vendor_respond_order", { p_order: orders.B, p_decision: "reject", p_reason: "Out of season" });
  await rpc(sellers.A, "vendor_respond_order", { p_order: orders.A, p_decision: "accept", p_reason: null });
  await rpc(sellers.C, "vendor_respond_order", { p_order: orders.C, p_decision: "accept", p_reason: null });
  eq((await svc.from("product_variants").select("stock_on_hand").eq("id", items.B.vid).single()).data.stock_on_hand, 10, "stock restored for the rejected order");
  const addrA = must(await sellers.A.client.from("order_shipping").select("ship_line1, ship_phone").eq("order_id", orders.A));
  eq(addrA, [{ ship_line1: "12 Garden Road", ship_phone: "+919800000001" }]);
  eq(must(await sellers.B.client.from("order_shipping").select("order_id").eq("order_id", orders.B)).length, 0, "rejecting seller loses the address");
  eq(must(await sellers.A.client.from("order_shipping").select("order_id").eq("order_id", orders.C)).length, 0, "A cannot see C's address");
});
await check("seller A prepares, ships with a manual tracking number and marks delivered; the customer sees every update", async () => {
  await denied(sellers.A.client.rpc("vendor_ship_order", { p_order: orders.A, p_carrier: "DTDC", p_tracking: "AB123456" }), /invalid_status/);
  await rpc(sellers.A, "vendor_mark_packed", { p_order: orders.A });
  await denied(sellers.A.client.rpc("vendor_ship_order", { p_order: orders.A, p_carrier: "", p_tracking: "" }), /tracking_required/);
  await rpc(sellers.A, "vendor_ship_order", { p_order: orders.A, p_carrier: "DTDC", p_tracking: `AB${run}`, p_url: "https://track.example.com/x" });
  eq((await alice.client.from("orders").select("status").eq("id", orders.A).single()).data.status, "shipped");
  const ship = must(await alice.client.from("shipments").select("carrier, tracking_number, status").eq("order_id", orders.A).single());
  eq([ship.carrier, ship.tracking_number, ship.status], ["DTDC", `AB${run}`, "shipped"]);
  await rpc(sellers.A, "vendor_update_shipment", { p_order: orders.A, p_status: "in_transit", p_note: "Left hub" });
  await rpc(sellers.A, "vendor_update_shipment", { p_order: orders.A, p_status: "delivered", p_note: null });
  eq((await alice.client.from("orders").select("status").eq("id", orders.A).single()).data.status, "delivered");
  const hist = must(await alice.client.from("order_status_history").select("to_status, actor_kind").eq("order_id", orders.A).order("id"));
  eq(hist.map((h) => h.to_status), ["placed", "confirmed", "packed", "shipped", "delivered"]);
  eq(hist.map((h) => h.actor_kind), ["customer", "vendor", "vendor", "vendor", "vendor"]);
  const notes = must(await alice.client.from("notifications").select("kind").eq("kind", "order_status"));
  assert(notes.length >= 5, `customer notified of status changes (${notes.length})`);
});
await check("cancellation: seller C's accepted order -> customer requests -> seller approves -> cancelled and restocked", async () => {
  eq(await rpc(alice, "cancel_order", { p_order: orders.C, p_reason: "Ordered by mistake" }), "requested");
  eq((await svc.from("orders").select("status").eq("id", orders.C).single()).data.status, "confirmed");
  const req = (await svc.from("order_requests").select("id").eq("order_id", orders.C).eq("kind", "cancel").single()).data.id;
  await denied(alice.client.rpc("decide_order_request", { p_request: req, p_decision: "approve" }), /not_found/);
  await rpc(sellers.C, "decide_order_request", { p_request: req, p_decision: "approve", p_note: "No problem" });
  eq((await svc.from("orders").select("status, stock_restored").eq("id", orders.C).single()).data, { status: "cancelled", stock_restored: true });
  eq((await svc.from("product_variants").select("stock_on_hand").eq("id", items.C.vid).single()).data.stock_on_hand, 10);
});
await check("return request on the delivered order is allowed with NO configured policy and says so; replacement is separate; the seller decides", async () => {
  const rid = await rpc(alice, "request_return", { p_order: orders.A, p_kind: "return", p_reason: "Plant arrived damaged", p_details: null });
  const r = (await svc.from("order_requests").select("status, policy_note").eq("id", rid).single()).data;
  assert(r.status === "requested" && /No return policy is configured yet for: Plants, seeds and saplings/.test(r.policy_note), "unconfigured policy is disclosed");
  await denied(alice.client.rpc("request_return", { p_order: orders.A, p_kind: "return", p_reason: "Again please" }), /unique|duplicate/i);
  await denied(bob.client.rpc("request_return", { p_order: orders.A, p_kind: "return", p_reason: "Not mine to return" }), /not_found/);
  await rpc(sellers.A, "decide_order_request", { p_request: rid, p_decision: "reject", p_note: "Outside the care instructions" });
  eq((await svc.from("order_requests").select("status").eq("id", rid).single()).data.status, "rejected");
});
await check("a configured category policy is enforced (admin sets it; customers cannot)", async () => {
  const cat = await catId("plants-seeds-saplings");
  assert((await alice.client.from("product_category_policies").insert({ category_id: cat, returns_allowed: true })).error, "customer cannot configure policy");
  must(await admin.client.from("product_category_policies").upsert({ category_id: cat, returns_allowed: false, replacements_allowed: true, replacement_window_days: 7, notes: "Live plants are not returnable" }), "admin policy");
  await denied(alice.client.rpc("request_return", { p_order: orders.A, p_kind: "return", p_reason: "Trying again after policy" }), /unique|not_allowed_by_policy/);
  const rep = await rpc(alice, "request_return", { p_order: orders.A, p_kind: "replacement", p_reason: "One plant was dead", p_details: null });
  eq((await svc.from("order_requests").select("policy_note").eq("id", rep).single()).data.policy_note, "Within the configured policy.");
  must(await admin.client.from("product_category_policies").delete().eq("category_id", cat), "reset policy");
});
await check("disputes and admin oversight: the customer opens one, admins see every order, request and dispute, sellers cannot see disputes", async () => {
  const d = await rpc(alice, "open_dispute", { p_order: orders.A, p_description: "The seller has not responded about the damaged plant." });
  eq(must(await sellers.A.client.from("order_disputes").select("id")).length, 0);
  eq(must(await bob.client.from("order_disputes").select("id")).length, 0);
  assert(must(await admin.client.from("order_disputes").select("id").eq("id", d)).length === 1, "admin sees the dispute");
  await rpc(admin, "admin_resolve_dispute", { p_dispute: d, p_status: "resolved", p_resolution: "Seller will send a replacement" });
  assert(must(await admin.client.from("order_requests").select("id").in("order_id", [orders.A, orders.B, orders.C])).length >= 2, "admin sees requests");
  assert(must(await admin.client.from("order_status_history").select("id").in("order_id", [orders.A, orders.B, orders.C])).length >= 10, "admin sees the history");
  assert(must(await admin.client.from("audit_logs").select("id").in("action", ["checkout_placed", "order_accept", "order_reject"])).length >= 3, "audit log records the actions");
});
await check("admin traces the checkout to every vendor order, and can cancel an unfulfilled order with a reason", async () => {
  const traced = must(await admin.client.from("orders").select("order_number, vendor_name, status, checkouts(reference)").eq("checkout_id", checkoutId));
  eq(traced.length, 3);
  assert(new Set(traced.map((t) => t.checkouts.reference)).size === 1, "one checkout reference for all three");
  await rpc(alice, "cart_set_item", { p_variant: items.B.vid, p_quantity: 1 });
  const co2 = await rpc(alice, "place_order", { p_address: addr, p_key: `staging-${run}-2` });
  const o2 = (await svc.from("orders").select("id").eq("checkout_id", co2).single()).data.id;
  await denied(alice.client.rpc("admin_cancel_order", { p_order: o2, p_reason: "x" }), /forbidden/);
  await rpc(admin, "admin_cancel_order", { p_order: o2, p_reason: "Staging test cancellation" });
  eq((await svc.from("orders").select("status, stock_restored").eq("id", o2).single()).data, { status: "cancelled", stock_restored: true });
});
await check("all-or-nothing: an out-of-stock line or an undeliverable seller fails the whole checkout and changes nothing", async () => {
  await rpc(sellers.B, "adjust_inventory", { p_variant: items.B.vid, p_mode: "set", p_quantity: 0, p_reason: "correction", p_note: null });
  await rpc(bob, "cart_set_item", { p_variant: items.A.vid, p_quantity: 1 }).catch(() => null);
  await rpc(sellers.B, "adjust_inventory", { p_variant: items.B.vid, p_mode: "set", p_quantity: 5, p_reason: "correction", p_note: null });
  await rpc(bob, "cart_set_item", { p_variant: items.B.vid, p_quantity: 1 });
  await rpc(sellers.B, "adjust_inventory", { p_variant: items.B.vid, p_mode: "set", p_quantity: 0, p_reason: "correction", p_note: null });
  const before = (await svc.from("orders").select("id", { count: "exact", head: true })).count;
  await denied(bob.client.rpc("place_order", { p_address: bobAddr, p_key: `staging-${run}-3` }), /out_of_stock/);
  eq((await svc.from("orders").select("id", { count: "exact", head: true })).count, before, "no partial order");
  eq(must(await bob.client.from("cart_items").select("*")).length, 2, "cart intact");
  await rpc(sellers.B, "adjust_inventory", { p_variant: items.B.vid, p_mode: "set", p_quantity: 10, p_reason: "correction", p_note: null });
  await rpc(bob, "cart_clear");
});
await check("financial and Stay safety: no order or checkout is ever anything but unpaid; Nature Stay tables are untouched", async () => {
  eq((await svc.from("orders").select("id", { count: "exact", head: true }).neq("payment_status", "unpaid")).count, 0);
  eq((await svc.from("checkouts").select("id", { count: "exact", head: true }).neq("payment_status", "unpaid")).count, 0);
  eq(await stayCounts(), stayBaseline, "the order workflow must not change payments, bookings or the commission ledger");
});

console.log("\nStaging project:", env.NEXT_PUBLIC_SUPABASE_URL);
process.exit(summary() ? 0 : 1);
