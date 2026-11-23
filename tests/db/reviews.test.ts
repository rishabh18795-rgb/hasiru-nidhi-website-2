import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

/** M7: only a delivered order line or a completed service can be reviewed, once, by its customer; moderation gates everything public. */
let db: Db;
let admin: string, alice: string, bob: string, seller: string;
let vendor: string, productId: string, productSlug: string, serviceId: string, serviceSlug: string, variant: string;
let orderItem: string, requestId: string, address: string;

const flag = (key: string, value: boolean) => db.query("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);
const rpc = <T extends Record<string, unknown> = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) => as<T>(db, user, sql, params);
const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
let k = 0;
const key = () => `rk-${Date.now()}-${k++}`;
const reviews = async (user: string | null, kind: "product" | "service") =>
  (await rpc<{ r: { count: number; average: string | null; reviews: { rating: number; author: string; body: string }[] } | null }>(user, "select public.get_marketplace_reviews($1, $2) as r", [kind, kind === "product" ? productSlug : serviceSlug]))[0].r;
const submit = (user: string, kind: string, ref: string, rating = 5, body = "Really good, would buy again.") =>
  rpc<{ id: string }>(user, "select public.submit_marketplace_review($1, $2, $3, 'Great', $4) as id", [kind, ref, rating, body]);

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@test.dev");
  for (const f of ["marketplace_vendor_registration_enabled", "marketplace_products_enabled", "marketplace_orders_enabled", "marketplace_services_enabled"]) await flag(f, true);
  alice = await createUser(db, "alice@test.dev", { full_name: "Alice Rao" });
  bob = await createUser(db, "bob@test.dev", { full_name: "Bob" });
  seller = await createUser(db, "s@test.dev", { full_name: "Seller" });
  vendor = (await rpc<{ id: string }>(seller, "select public.save_vendor_profile($1::jsonb) as id", [JSON.stringify({ business_name: "Green Farm", business_type: "farm", contact_name: "S", contact_email: "s@test.dev",
    contact_phone: "+919876543210", address_line: "1 Farm Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078" })]))[0].id;
  await rpc(seller, "select public.submit_vendor_application('{products,services}'::public.vendor_capability[])");
  await rpc(admin, "select public.admin_review_vendor($1, 'approve', null)", [vendor]);
  for (const c of ["products", "services"]) await rpc(admin, "select public.admin_review_capability($1, $2::public.vendor_capability, 'approve', null)", [vendor, c]);
  await rpc(seller, "select public.set_vendor_service_areas('delivery', array['560'])");
  await rpc(seller, "select public.set_vendor_service_areas('service', array['560'])");

  const cat = (await one<{ id: number }>("select id from public.product_categories where slug = 'plants-seeds-saplings'")).id;
  productId = (await rpc<{ id: string }>(seller, "select public.save_product($1::jsonb) as id", [JSON.stringify({ category_id: cat, name: "Tulsi sapling", summary: "s", description: "A healthy tulsi sapling in a small pot, ready to plant out." })]))[0].id;
  variant = (await rpc<{ id: string }>(seller, "select public.save_product_variant($1::jsonb) as id", [JSON.stringify({ product_id: productId, sku: "T-1", name: "Small", price_inr: 60, initial_stock: 10 })]))[0].id;
  await rpc(seller, "select public.register_product_image($1, $2, 'alt')", [productId, `${vendor}/${productId}/a.jpg`]);
  await rpc(seller, "select public.submit_product($1)", [productId]);
  await rpc(admin, "select public.admin_review_product($1, 'approve', null)", [productId]);
  productSlug = (await one<{ slug: string }>("select slug from public.products where id = $1", [productId])).slug;

  const sc = (await one<{ id: number }>("select id from public.service_categories where slug = 'gardening'")).id;
  serviceId = (await rpc<{ id: string }>(seller, "select public.save_service($1::jsonb) as id", [JSON.stringify({ category_id: sc, name: "Lawn care", summary: "s", description: "Mowing and tidying of a home lawn, tools included in the visit.", pricing_model: "fixed", price_inr: 500, price_unit: "visit", duration_minutes: 60 })]))[0].id;
  await rpc(seller, "select public.register_service_image($1, $2, 'alt')", [serviceId, `${vendor}/${serviceId}/a.jpg`]);
  await rpc(seller, "select public.submit_service($1)", [serviceId]);
  await rpc(admin, "select public.admin_review_service($1, 'approve', null)", [serviceId]);
  serviceSlug = (await one<{ slug: string }>("select slug from public.services where id = $1", [serviceId])).slug;

  address = (await rpc<{ id: string }>(alice, "select public.save_address($1::jsonb) as id", [JSON.stringify({ full_name: "Alice Rao", phone: "9876500000", line1: "12 Rose Street", city: "Bengaluru", state: "Karnataka", postal_code: "560078" })]))[0].id;
  await rpc(alice, "select public.cart_set_item($1, 1)", [variant]);
  const checkout = (await rpc<{ id: string }>(alice, "select public.place_order($1, $2) as id", [address, key()]))[0].id;
  const order = (await one<{ id: string }>("select id from public.orders where checkout_id = $1", [checkout])).id;
  orderItem = (await one<{ id: string }>("select id from public.order_items where order_id = $1", [order])).id;
  (globalThis as { __order?: string }).__order = order;
});

describe("product reviews: verified purchases only", () => {
  it("cannot be written before the order is delivered", async () => {
    expect(await failure(db, alice, "select public.submit_marketplace_review('product', $1, 5, 'Great', 'Really good, would buy again.')", [orderItem])).toMatch(/not_eligible/);
  });

  it("can be written by the buyer once delivered, starts PENDING, and only the buyer can write it", async () => {
    const order = (globalThis as { __order?: string }).__order!;
    await rpc(seller, "select public.vendor_respond_order($1, 'accept', null)", [order]);
    await rpc(seller, "select public.vendor_mark_packed($1)", [order]);
    await rpc(seller, "select public.vendor_ship_order($1, 'DTDC', 'TRK12345', null)", [order]);
    await rpc(seller, "select public.vendor_update_shipment($1, 'delivered', null)", [order]);
    expect(await failure(db, bob, "select public.submit_marketplace_review('product', $1, 5, 'Great', 'Really good, would buy again.')", [orderItem])).toMatch(/not_found/);
    expect(await failure(db, null, "select public.submit_marketplace_review('product', $1, 5, 'Great', 'Really good, would buy again.')", [orderItem])).toMatch(/permission denied/i);
    expect(await failure(db, alice, "select public.submit_marketplace_review('product', $1, 6, 'x', 'Really good, would buy again.')", [orderItem])).toMatch(/invalid_rating/);
    expect(await failure(db, alice, "select public.submit_marketplace_review('product', $1, 4, 'x', 'short')", [orderItem])).toMatch(/review_body_required/);
    const id = (await submit(alice, "product", orderItem, 4, "Healthy plant, arrived well packed."))[0].id;
    expect((await one<{ status: string }>("select status from public.marketplace_reviews where id = $1", [id])).status).toBe("pending");
    expect(await failure(db, alice, "select public.submit_marketplace_review('product', $1, 5, 'Again', 'Trying to review twice, which is not allowed.')", [orderItem])).toMatch(/already_reviewed/);
  });

  it("is invisible to the public, other customers and the vendor until approved; the author and admin can see it", async () => {
    expect((await reviews(null, "product"))?.count).toBe(0);
    expect(await rpc(bob, "select id from public.marketplace_reviews")).toHaveLength(0);
    expect(await rpc(seller, "select id from public.marketplace_reviews")).toHaveLength(0);
    expect(await rpc(alice, "select id from public.marketplace_reviews")).toHaveLength(1);
    expect(await rpc(admin, "select id from public.marketplace_reviews")).toHaveLength(1);
  });

  it("only an administrator can moderate; rejecting needs a reason; approval publishes it with the first name only", async () => {
    const id = (await one<{ id: string }>("select id from public.marketplace_reviews where kind = 'product'")).id;
    expect(await failure(db, alice, "select public.admin_moderate_marketplace_review($1, 'approve', null)", [id])).toMatch(/forbidden/);
    expect(await failure(db, seller, "select public.admin_moderate_marketplace_review($1, 'approve', null)", [id])).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.admin_moderate_marketplace_review($1, 'reject', ' ')", [id])).toMatch(/reason_required/);
    await rpc(admin, "select public.admin_moderate_marketplace_review($1, 'approve', null)", [id]);
    const r = (await reviews(null, "product"))!;
    expect([r.count, Number(r.average), r.reviews[0].author, r.reviews[0].rating]).toEqual([1, 4, "Alice", 4]);
    expect(JSON.stringify(r)).not.toMatch(/Rao|alice@|author_id/);
    expect(await rpc(seller, "select id from public.marketplace_reviews")).toHaveLength(1); // the vendor sees approved reviews of their own listing
    await rpc(admin, "select public.admin_moderate_marketplace_review($1, 'reject', 'Off topic')", [id]);
    expect((await reviews(null, "product"))?.count).toBe(0);
    await rpc(admin, "select public.admin_moderate_marketplace_review($1, 'approve', null)", [id]);
  });

  it("the review text can never be edited or deleted, and nobody can write the table directly", async () => {
    await expect(db.query("update public.marketplace_reviews set rating = 1")).rejects.toThrow(/review_content_is_immutable/);
    await expect(db.query("update public.marketplace_reviews set body = 'edited by someone later on'")).rejects.toThrow(/review_content_is_immutable/);
    await expect(db.query("delete from public.marketplace_reviews")).rejects.toThrow(/reviews_cannot_be_deleted/);
    for (const who of [alice, seller, admin]) expect(await failure(db, who, "update public.marketplace_reviews set status = 'approved'")).toMatch(/permission denied/i);
    expect(await failure(db, alice, "insert into public.marketplace_reviews (kind, vendor_id, rating, body) values ('product', $1, 5, 'direct insert attempt here')", [vendor])).toMatch(/permission denied/i);
  });

  it("disappears from the public page when its listing is no longer public", async () => {
    await flag("marketplace_products_enabled", false);
    expect(await reviews(null, "product")).toBeNull();
    await flag("marketplace_products_enabled", true);
    expect((await reviews(null, "product"))?.count).toBe(1);
  });
});

describe("service reviews: completed services only", () => {
  it("cannot be written until the service is completed; then once, by the customer", async () => {
    const pref = null;
    requestId = (await rpc<{ id: string }>(alice, "select public.request_service($1::jsonb, $2) as id", [JSON.stringify({ service_id: serviceId, quantity: 1, customer_name: "Alice", phone: "9876500000", address_line: "12 Rose Street", city: "Bengaluru", pin: "560078", details: "Trim the lawn.", preferred_start: pref }), key()]))[0].id;
    expect(await failure(db, alice, "select public.submit_marketplace_review('service', $1, 5, 'Great', 'Lovely work on the lawn, thank you.')", [requestId])).toMatch(/not_eligible/);
    await rpc(seller, "select public.provider_respond_service_request($1, 'accept', null)", [requestId]);
    await rpc(seller, "select public.provider_complete_service($1)", [requestId]);
    expect(await failure(db, bob, "select public.submit_marketplace_review('service', $1, 5, 'Great', 'Lovely work on the lawn, thank you.')", [requestId])).toMatch(/not_found/);
    const id = (await submit(alice, "service", requestId, 5, "Lovely work on the lawn, thank you."))[0].id;
    expect(await failure(db, alice, "select public.submit_marketplace_review('service', $1, 5, 'Again', 'Trying to review this twice, not allowed.')", [requestId])).toMatch(/already_reviewed/);
    expect((await reviews(null, "service"))?.count).toBe(0);
    await rpc(admin, "select public.admin_moderate_marketplace_review($1, 'approve', null)", [id]);
    const r = (await reviews(null, "service"))!;
    expect([r.count, Number(r.average), r.reviews[0].author]).toEqual([1, 5, "Alice"]);
  });

  it("a cancelled request can never be reviewed", async () => {
    await rpc(alice, "select public.cancel_service_request($1, null)", [requestId]).catch(() => undefined);
    const r2 = (await rpc<{ id: string }>(bob, "select public.request_service($1::jsonb, $2) as id", [JSON.stringify({ service_id: serviceId, quantity: 1, customer_name: "Bob", phone: "9876511111", address_line: "5 Oak Road", city: "Bengaluru", pin: "560078" }), key()]))[0].id;
    await rpc(bob, "select public.cancel_service_request($1, null)", [r2]);
    expect(await failure(db, bob, "select public.submit_marketplace_review('service', $1, 5, 'x', 'I never got this service at all.')", [r2])).toMatch(/not_eligible/);
  });
});
