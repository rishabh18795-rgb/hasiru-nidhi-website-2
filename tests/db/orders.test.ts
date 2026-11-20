import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

/**
 * M4 cart, checkout and product orders: multi-vendor splitting, atomic stock, idempotency, vendor/customer/admin isolation, fulfilment,
 * cancellation, returns by category policy, disputes, and the rule that nothing can ever show a payment as received.
 */
let db: Db;
let admin: string;
let alice: string; // customer
let bob: string; // another customer
let sA: string, sB: string, sC: string; // three sellers
let vA: string, vB: string, vC: string; // their vendor ids
let vtA: string, vtB: string, vtC: string; // one variant each: 500, 500, 250
let pidA: string;
let addr: string;
let catPlants: number;
let catTools: number;

const flag = (key: string, value: boolean) => db.query("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);
const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const all = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const rpc = <T extends Record<string, unknown> = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) => as<T>(db, user, sql, params);
const num = (v: unknown) => Number(v);
let keyN = 0;
const key = () => `key-${Date.now()}-${keyN++}`;

async function makeSeller(email: string, name: string): Promise<{ user: string; vendor: string }> {
  const user = await createUser(db, email, { full_name: name });
  const vendor = (await rpc<{ id: string }>(user, "select public.save_vendor_profile($1::jsonb) as id", [JSON.stringify({ business_name: name, business_type: "farm", contact_name: name, contact_email: email,
    contact_phone: "+919876543210", address_line: "1 Farm Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078" })]))[0].id;
  await rpc(user, "select public.submit_vendor_application('{products}'::public.vendor_capability[])");
  await rpc(admin, "select public.admin_review_vendor($1, 'approve', null)", [vendor]);
  await rpc(admin, "select public.admin_review_capability($1, 'products', 'approve', null)", [vendor]);
  await rpc(user, "select public.set_vendor_service_areas('delivery', array['560'])");
  return { user, vendor };
}

/** An approved, public product with one variant. Returns {product, variant}. */
async function listProduct(user: string, vendor: string, name: string, price: number, stock: number, category = catPlants, track = true): Promise<{ product: string; variant: string }> {
  const product = (await rpc<{ id: string }>(user, "select public.save_product($1::jsonb) as id", [JSON.stringify({ category_id: category, name, summary: "s", description: `${name}: a product with a description that is long enough to pass the checks.`, attributes: [] })]))[0].id;
  const variant = (await rpc<{ id: string }>(user, "select public.save_product_variant($1::jsonb) as id", [JSON.stringify({ product_id: product, sku: `SKU-${product.slice(0, 6)}`, name: "Standard", price_inr: price, initial_stock: stock, track_inventory: track })]))[0].id;
  await rpc(user, "select public.register_product_image($1, $2, 'alt')", [product, `${vendor}/${product}/a.jpg`]);
  await rpc(user, "select public.submit_product($1)", [product]);
  await rpc(admin, "select public.admin_review_product($1, 'approve', null)", [product]);
  return { product, variant };
}

const addToCart = (user: string, variant: string, qty: number) => rpc(user, "select public.cart_set_item($1, $2)", [variant, qty]);
const cart = async (user: string, pin: string | null = null) => (await rpc<{ c: { lines: Record<string, unknown>[]; vendors: Record<string, unknown>[]; item_count: number; subtotal_inr: string } }>(user, "select public.get_cart($1) as c", [pin]))[0].c;
const place = async (user: string, address = addr, k = key()) => (await rpc<{ id: string }>(user, "select public.place_order($1, $2) as id", [address, k]))[0].id;
const stock = async (variant: string) => num((await one<{ s: number }>("select stock_on_hand as s from public.product_variants where id = $1", [variant])).s);
const ordersOf = (checkout: string) => all<{ id: string; vendor_id: string; items_total_inr: string; status: string; payment_status: string; order_number: string }>("select id, vendor_id, items_total_inr, status, payment_status, order_number from public.orders where checkout_id = $1 order by items_total_inr desc", [checkout]);
const orderFor = async (checkout: string, vendor: string) => (await one<{ id: string }>("select id from public.orders where checkout_id = $1 and vendor_id = $2", [checkout, vendor])).id;
const status = async (order: string) => (await one<{ status: string }>("select status from public.orders where id = $1", [order])).status;

/** A fresh single-line order from `variantOwner`'s product, placed by `buyer`. */
async function freshOrder(buyer: string, variant: string, vendor: string, qty = 1): Promise<string> {
  await addToCart(buyer, variant, qty);
  const checkout = await place(buyer, (await one<{ id: string }>("select id from public.customer_addresses where user_id = $1 limit 1", [buyer])).id);
  return orderFor(checkout, vendor);
}

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@test.dev");
  await flag("marketplace_vendor_registration_enabled", true);
  await flag("marketplace_products_enabled", true);
  alice = await createUser(db, "alice@test.dev", { full_name: "Alice" });
  bob = await createUser(db, "bob@test.dev", { full_name: "Bob" });
  ({ user: sA, vendor: vA } = await makeSeller("a@test.dev", "Seller A"));
  ({ user: sB, vendor: vB } = await makeSeller("b@test.dev", "Seller B"));
  ({ user: sC, vendor: vC } = await makeSeller("c@test.dev", "Seller C"));
  catPlants = (await one<{ id: number }>("select id from public.product_categories where slug = 'plants-seeds-saplings'")).id;
  catTools = (await one<{ id: number }>("select id from public.product_categories where slug = 'gardening-tools-accessories'")).id;
  const a = await listProduct(sA, vA, "Product A", 500, 10);
  ({ variant: vtA, product: pidA } = a);
  ({ variant: vtB } = await listProduct(sB, vB, "Product B", 500, 10, catTools));
  ({ variant: vtC } = await listProduct(sC, vC, "Product C", 250, 10));
});

describe("the module is OFF until an administrator turns orders on", () => {
  it("refuses carts and checkouts while the orders flag is OFF, and says so", async () => {
    expect(await failure(db, alice, "select public.cart_set_item($1, 1)", [vtA])).toMatch(/orders_closed/);
    expect((await cart(alice)).lines).toEqual([]);
    expect((await rpc<{ e: boolean }>(null, "select public.orders_enabled() as e"))[0].e).toBe(false);
    await flag("marketplace_orders_enabled", true);
    expect((await rpc<{ e: boolean }>(null, "select public.orders_enabled() as e"))[0].e).toBe(true);
  });
  it("the orders flag alone is not enough: the products flag must be ON as well", async () => {
    await flag("marketplace_products_enabled", false);
    expect((await rpc<{ e: boolean }>(null, "select public.orders_enabled() as e"))[0].e).toBe(false);
    await flag("marketplace_products_enabled", true);
  });
});

describe("addresses", () => {
  it("saves, defaults and switches the default; first address is the default", async () => {
    addr = (await rpc<{ id: string }>(alice, "select public.save_address($1::jsonb) as id", [JSON.stringify({ label: "Home", full_name: "Alice Rao", phone: "+919800000001", line1: "12 Garden Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078" })]))[0].id;
    expect((await one<{ is_default: boolean }>("select is_default from public.customer_addresses where id = $1", [addr])).is_default).toBe(true);
    const second = (await rpc<{ id: string }>(alice, "select public.save_address($1::jsonb) as id", [JSON.stringify({ full_name: "Alice Rao", phone: "+919800000001", line1: "Office", city: "Mysuru", state: "Karnataka", postal_code: "570001", is_default: true })]))[0].id;
    expect(await all("select 1 from public.customer_addresses where user_id = $1 and is_default", [alice])).toHaveLength(1);
    expect((await one<{ is_default: boolean }>("select is_default from public.customer_addresses where id = $1", [second])).is_default).toBe(true);
    await rpc(alice, "select public.set_default_address($1)", [addr]);
    await rpc(alice, "select public.delete_address($1)", [second]);
    expect((await one<{ is_default: boolean }>("select is_default from public.customer_addresses where id = $1", [addr])).is_default).toBe(true);
  });
  it("validates the PIN and required fields, and is private to its owner", async () => {
    const bad = (extra: Record<string, unknown>) => failure(db, alice, "select public.save_address($1::jsonb)", [JSON.stringify({ full_name: "A B", phone: "+919800000001", line1: "Road", city: "X", state: "Y", postal_code: "560078", ...extra })]);
    expect(await bad({ postal_code: "5600" })).toMatch(/invalid_pin/);
    expect(await bad({ line1: "" })).toMatch(/address_incomplete/);
    expect(await rpc(bob, "select id from public.customer_addresses")).toHaveLength(0);
    expect(await failure(db, bob, "select public.delete_address($1)", [addr])).toMatch(/not_found/);
    expect(await failure(db, bob, "select public.set_default_address($1)", [addr])).toMatch(/not_found/);
    expect(await failure(db, bob, "select public.save_address($1::jsonb)", [JSON.stringify({ id: addr, full_name: "Bob", phone: "+919800000002", line1: "Road", city: "X", state: "Y", postal_code: "560078" })])).toMatch(/not_found/);
    expect(await failure(db, alice, "update public.customer_addresses set city = 'Hacked'")).toMatch(/permission denied/);
  });
  it("limits a customer to 10 addresses", async () => {
    const c = await createUser(db, "many@test.dev", { full_name: "Many" });
    for (let i = 0; i < 10; i++) await rpc(c, "select public.save_address($1::jsonb)", [JSON.stringify({ full_name: "Many One", phone: "+919800000003", line1: `Road ${i}`, city: "Bengaluru", state: "Karnataka", postal_code: "560001" })]);
    expect(await failure(db, c, "select public.save_address($1::jsonb)", [JSON.stringify({ full_name: "Many One", phone: "+919800000003", line1: "Road 11", city: "Bengaluru", state: "Karnataka", postal_code: "560001" })])).toMatch(/too_many_addresses/);
  });
  it("bob gets his own address for later tests", async () => {
    await rpc(bob, "select public.save_address($1::jsonb)", [JSON.stringify({ full_name: "Bob Nair", phone: "+919800000002", line1: "5 Lake Road", city: "Bengaluru", state: "Karnataka", postal_code: "560001" })]);
  });
});

describe("cart", () => {
  it("adds, changes, removes and persists, with live prices", async () => {
    expect(num((await rpc<{ q: number }>(alice, "select public.cart_set_item($1, 2) as q", [vtA]))[0].q)).toBe(2);
    expect(num((await rpc<{ q: number }>(alice, "select public.cart_set_item($1, 3) as q", [vtA]))[0].q)).toBe(3);
    const c = await cart(alice);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]).toMatchObject({ quantity: 3, product_name: "Product A", vendor_name: "Seller A", issue: null });
    expect(num(c.lines[0].line_total_inr)).toBe(1500);
    expect(num(c.subtotal_inr)).toBe(1500);
    await rpc(alice, "select public.cart_set_item($1, 0)", [vtA]);
    expect((await cart(alice)).lines).toEqual([]);
  });
  it("is private, and the quantity and stock are validated", async () => {
    await addToCart(alice, vtA, 1);
    expect((await cart(bob)).lines).toEqual([]);
    expect(await rpc(bob, "select 1 from public.cart_items")).toHaveLength(0);
    expect(await failure(db, alice, "select public.cart_set_item($1, 100)", [vtA])).toMatch(/invalid_quantity/);
    expect(await failure(db, alice, "select public.cart_set_item($1, -1)", [vtA])).toMatch(/invalid_quantity/);
    expect(await failure(db, alice, "select public.cart_set_item($1, 11)", [vtA])).toMatch(/insufficient_stock:10/);
    expect(await failure(db, alice, "insert into public.cart_items (user_id, variant_id, quantity) values ($1, $2, 1)", [alice, vtB])).toMatch(/permission denied/);
    expect(await failure(db, null, "select public.get_cart()")).toMatch(/permission denied/);
    await rpc(alice, "select public.cart_clear()");
  });
  it("refuses your own products and anything that is not public or is paused", async () => {
    expect(await failure(db, sA, "select public.cart_set_item($1, 1)", [vtA])).toMatch(/own_product/);
    const draft = (await rpc<{ id: string }>(sA, "select public.save_product($1::jsonb) as id", [JSON.stringify({ category_id: catPlants, name: "Hidden draft", description: "d" })]))[0].id;
    const dv = (await rpc<{ id: string }>(sA, "select public.save_product_variant($1::jsonb) as id", [JSON.stringify({ product_id: draft, sku: "D1", name: "x", price_inr: 10, initial_stock: 5 })]))[0].id;
    expect(await failure(db, alice, "select public.cart_set_item($1, 1)", [dv])).toMatch(/product_unavailable/);
    await rpc(sA, "select public.set_product_availability($1, false)", [pidA]);
    expect(await failure(db, alice, "select public.cart_set_item($1, 1)", [vtA])).toMatch(/product_paused/);
    await rpc(sA, "select public.set_product_availability($1, true)", [pidA]);
  });
  it("shows per-seller delivery answers for a PIN, and flags problems on lines", async () => {
    await addToCart(alice, vtA, 2);
    await addToCart(alice, vtB, 1);
    const ok = await cart(alice, "560078");
    expect(ok.vendors.map((v) => v.delivery)).toEqual(["yes", "yes"]);
    const far = await cart(alice, "110001");
    expect(far.vendors.map((v) => v.delivery)).toEqual(["no", "no"]);
    await rpc(sA, "select public.adjust_inventory($1, 'set', 1, 'correction', null)", [vtA]);
    const limited = await cart(alice);
    expect(limited.lines.find((l) => l.product_name === "Product A")).toMatchObject({ issue: "limited_stock", max_qty: 1 });
    await rpc(sA, "select public.adjust_inventory($1, 'set', 10, 'correction', null)", [vtA]);
    await rpc(alice, "select public.cart_clear()");
  });
});

describe("checkout: one customer checkout -> one order per vendor", () => {
  let checkout: string;
  it("splits a three-vendor cart (1,000 / 500 / 750) into three independent orders linked to one checkout", async () => {
    await addToCart(alice, vtA, 2); // Seller A: 2 x 500 = 1,000
    await addToCart(alice, vtB, 1); // Seller B: 1 x 500 = 500
    await addToCart(alice, vtC, 3); // Seller C: 3 x 250 = 750
    checkout = await place(alice);
    const orders = await ordersOf(checkout);
    expect(orders.map((o) => num(o.items_total_inr))).toEqual([1000, 750, 500]);
    expect(new Set(orders.map((o) => o.vendor_id))).toEqual(new Set([vA, vB, vC]));
    expect(new Set(orders.map((o) => o.order_number)).size).toBe(3);
    const c = await one<{ reference: string; items_total_inr: string; order_count: number; payment_status: string; ship_postal_code: string }>("select * from public.checkouts where id = $1", [checkout]);
    expect(c.reference).toMatch(/^HN-C-\d+$/);
    expect(num(c.items_total_inr)).toBe(2250);
    expect(c.order_count).toBe(3);
    expect(c.ship_postal_code).toBe("560078");
    expect(orders.every((o) => /^HN-O-\d+$/.test(o.order_number))).toBe(true);
  });
  it("is UNPAID with no delivery fee, no tax and no payment record: nothing is invented", async () => {
    const orders = await all<{ payment_status: string; shipping_fee_inr: string | null; tax_inr: string | null }>("select payment_status, shipping_fee_inr, tax_inr from public.orders where checkout_id = $1", [checkout]);
    expect(orders.every((o) => o.payment_status === "unpaid" && o.shipping_fee_inr === null && o.tax_inr === null)).toBe(true);
    expect((await one<{ payment_status: string }>("select payment_status from public.checkouts where id = $1", [checkout])).payment_status).toBe("unpaid");
    expect(num((await one<{ n: string }>("select count(*) as n from public.payments")).n)).toBe(0);
  });
  it("snapshots every line and never changes it afterwards", async () => {
    const items = await all<{ product_name: string; unit_price_inr: string; quantity: number; line_total_inr: string; sku: string }>("select product_name, unit_price_inr, quantity, line_total_inr, sku from public.order_items where order_id in (select id from public.orders where checkout_id = $1) order by line_total_inr desc", [checkout]);
    expect(items.map((i) => [i.product_name, num(i.unit_price_inr), i.quantity, num(i.line_total_inr)])).toEqual([["Product A", 500, 2, 1000], ["Product C", 250, 3, 750], ["Product B", 500, 1, 500]]);
    await db.query("update public.product_variants set price_inr = 999 where id = $1", [vtA]);
    expect(num((await one<{ p: string }>("select unit_price_inr as p from public.order_items where product_name = 'Product A' limit 1")).p)).toBe(500);
    await db.query("update public.product_variants set price_inr = 500 where id = $1", [vtA]);
    await expect(db.query("update public.order_items set quantity = 9")).rejects.toThrow(/order_items_are_immutable/);
    await expect(db.query("delete from public.order_items")).rejects.toThrow(/order_items_are_immutable/);
  });
  it("deducts stock once per vendor, logs each movement against its order, empties the cart and writes status history and notifications", async () => {
    expect(await stock(vtA)).toBe(8);
    expect(await stock(vtB)).toBe(9);
    expect(await stock(vtC)).toBe(7);
    const mv = await all<{ delta: number; reason: string; order_id: string }>("select delta, reason, order_id from public.inventory_movements where reason = 'order_placed' order by delta");
    expect(mv.map((m) => m.delta)).toEqual([-3, -2, -1]);
    expect(mv.every((m) => m.order_id !== null)).toBe(true);
    expect((await cart(alice)).lines).toEqual([]);
    expect((await all("select 1 from public.order_status_history h join public.orders o on o.id = h.order_id where o.checkout_id = $1 and h.to_status = 'placed' and h.actor_kind = 'customer'", [checkout])).length).toBe(3);
    expect((await all("select 1 from public.notifications where user_id in ($1, $2, $3) and kind = 'order_placed'", [sA, sB, sC])).length).toBe(3);
    expect((await all("select 1 from public.notifications where user_id = $1 and kind = 'order_placed'", [alice])).length).toBe(1);
    expect((await all("select 1 from public.audit_logs where action = 'checkout_placed'")).length).toBeGreaterThan(0);
  });
  it("is idempotent: submitting twice with the same key returns the same checkout and takes stock once", async () => {
    await addToCart(alice, vtB, 2);
    const k = key();
    const first = await place(alice, addr, k);
    const again = await place(alice, addr, k);
    expect(again).toBe(first);
    expect(await stock(vtB)).toBe(7);
    expect(await ordersOf(first)).toHaveLength(1);
    expect(await all("select 1 from public.checkouts where user_id = $1 and idempotency_key = $2", [alice, k])).toHaveLength(1);
  });
});

describe("checkout is all-or-nothing and cannot oversell", () => {
  const snapshot = async () => ({ a: await stock(vtA), b: await stock(vtB), c: await stock(vtC), orders: num((await one<{ n: string }>("select count(*) as n from public.orders")).n), checkouts: num((await one<{ n: string }>("select count(*) as n from public.checkouts")).n) });

  it("rolls back everything when one vendor's line is out of stock", async () => {
    await addToCart(bob, vtA, 1);
    await addToCart(bob, vtB, 1);
    await rpc(sB, "select public.adjust_inventory($1, 'set', 0, 'correction', null)", [vtB]);
    const before = await snapshot();
    const bobAddr = (await one<{ id: string }>("select id from public.customer_addresses where user_id = $1", [bob])).id;
    expect(await failure(db, bob, "select public.place_order($1, $2)", [bobAddr, key()])).toMatch(/out_of_stock:Product B/);
    expect(await snapshot()).toEqual(before);
    expect((await cart(bob)).lines).toHaveLength(2); // the cart is untouched so the customer can fix it
    await rpc(sB, "select public.adjust_inventory($1, 'set', 7, 'correction', null)", [vtB]);
  });
  it("rolls back everything when a vendor does not deliver to the address", async () => {
    await rpc(sC, "select public.set_vendor_service_areas('delivery', array['110'])");
    const before = await snapshot();
    const bobAddr = (await one<{ id: string }>("select id from public.customer_addresses where user_id = $1", [bob])).id;
    await rpc(bob, "select public.cart_set_item($1, 1)", [vtC]);
    expect(await failure(db, bob, "select public.place_order($1, $2)", [bobAddr, key()])).toMatch(/not_deliverable:Seller C/);
    expect(await snapshot()).toEqual(before);
    await rpc(bob, "select public.cart_set_item($1, 0)", [vtC]);
    await rpc(sC, "select public.set_vendor_service_areas('delivery', array['560'])");
  });
  it("refuses a product that was withdrawn after it was added, an empty cart, a foreign address and a bad key", async () => {
    const bobAddr = (await one<{ id: string }>("select id from public.customer_addresses where user_id = $1", [bob])).id;
    await rpc(sA, "select public.set_product_availability($1, false)", [pidA]);
    expect(await failure(db, bob, "select public.place_order($1, $2)", [bobAddr, key()])).toMatch(/product_paused:Product A/);
    await rpc(sA, "select public.set_product_availability($1, true)", [pidA]);
    await rpc(bob, "select public.cart_clear()");
    expect(await failure(db, bob, "select public.place_order($1, $2)", [bobAddr, key()])).toMatch(/cart_empty/);
    await addToCart(bob, vtA, 1);
    expect(await failure(db, bob, "select public.place_order($1, $2)", [addr, key()])).toMatch(/address_required/); // alice's address
    expect(await failure(db, bob, "select public.place_order($1, 'short')", [bobAddr])).toMatch(/invalid_key/);
    expect(await failure(db, null, "select public.place_order($1, $2)", [bobAddr, key()])).toMatch(/permission denied/);
    await rpc(bob, "select public.cart_clear()");
  });
  it("never sells the last unit twice", async () => {
    const { variant } = await listProduct(sA, vA, "Last one", 100, 1);
    const bobAddr = (await one<{ id: string }>("select id from public.customer_addresses where user_id = $1", [bob])).id;
    await addToCart(alice, variant, 1);
    // Bob grabbed it in his cart before Alice paid for hers: both carts hold the last unit.
    await db.query("insert into public.cart_items (user_id, variant_id, quantity) values ($1, $2, 1)", [bob, variant]);
    await place(alice);
    expect(await stock(variant)).toBe(0);
    expect(await failure(db, bob, "select public.place_order($1, $2)", [bobAddr, key()])).toMatch(/out_of_stock:Last one/);
    expect(await stock(variant)).toBe(0);
    expect(num((await one<{ n: string }>("select count(*) as n from public.order_items where variant_id = $1", [variant])).n)).toBe(1);
    await rpc(bob, "select public.cart_clear()");
  });
  it("does not track stock for untracked variants", async () => {
    const { variant } = await listProduct(sA, vA, "Made to order", 80, 0, catPlants, false);
    await addToCart(alice, variant, 5);
    await place(alice);
    expect(await stock(variant)).toBe(0);
  });
});

describe("who can see what", () => {
  let checkout: string;
  let oA: string, oB: string;
  beforeAll(async () => {
    await addToCart(alice, vtA, 1);
    await addToCart(alice, vtB, 1);
    checkout = await place(alice);
    oA = await orderFor(checkout, vA);
    oB = await orderFor(checkout, vB);
  });
  it("each seller sees only their own order, customers only their own, admins all", async () => {
    expect((await rpc<{ id: string }>(sA, "select id from public.orders where checkout_id = $1", [checkout])).map((r) => r.id)).toEqual([oA]);
    expect((await rpc<{ id: string }>(sB, "select id from public.orders where checkout_id = $1", [checkout])).map((r) => r.id)).toEqual([oB]);
    expect(await rpc(sC, "select id from public.orders where checkout_id = $1", [checkout])).toHaveLength(0);
    expect(await rpc(bob, "select id from public.orders where checkout_id = $1", [checkout])).toHaveLength(0);
    expect(await rpc(alice, "select id from public.orders where checkout_id = $1", [checkout])).toHaveLength(2);
    expect(await rpc(admin, "select id from public.orders where checkout_id = $1", [checkout])).toHaveLength(2);
    expect(await failure(db, null, "select id from public.orders")).toMatch(/permission denied/);
  });
  it("items, history and shipments follow their order's visibility; sellers never read the checkout", async () => {
    expect((await rpc<{ product_name: string }>(sA, "select product_name from public.order_items where order_id in (select id from public.orders where checkout_id = $1)", [checkout])).map((r) => r.product_name)).toEqual(["Product A"]);
    expect(await rpc(bob, "select 1 from public.order_items")).toHaveLength(0);
    expect(await rpc(sA, "select id from public.checkouts")).toHaveLength(0);
    expect(await rpc(alice, "select id from public.checkouts where id = $1", [checkout])).toHaveLength(1);
    expect(await rpc(admin, "select id from public.order_status_history")).not.toHaveLength(0);
    expect(await rpc(sA, "select 1 from public.order_status_history where order_id = $1", [oB])).toHaveLength(0);
  });
  it("the customer's phone and street address are hidden from the seller until they accept, and hidden again if the order ends", async () => {
    expect(await rpc(sA, "select 1 from public.order_shipping where order_id = $1", [oA])).toHaveLength(0);
    expect((await rpc<{ ship_city: string }>(sA, "select ship_city from public.orders where id = $1", [oA]))[0].ship_city).toBe("Bengaluru"); // coarse info only
    await rpc(sA, "select public.vendor_respond_order($1, 'accept', null)", [oA]);
    expect((await rpc<{ ship_line1: string; ship_phone: string }>(sA, "select ship_line1, ship_phone from public.order_shipping where order_id = $1", [oA]))[0]).toEqual({ ship_line1: "12 Garden Road", ship_phone: "+919800000001" });
    expect(await rpc(sB, "select 1 from public.order_shipping where order_id = $1", [oA])).toHaveLength(0);
    expect(await rpc(sB, "select 1 from public.order_shipping where order_id = $1", [oB])).toHaveLength(0);
    expect(await rpc(alice, "select 1 from public.order_shipping where order_id = $1", [oA])).toHaveLength(1);
    expect(await rpc(admin, "select 1 from public.order_shipping where order_id = $1", [oA])).toHaveLength(1);
    await rpc(admin, "select public.admin_cancel_order($1, 'Test cleanup')", [oA]);
    expect(await rpc(sA, "select 1 from public.order_shipping where order_id = $1", [oA])).toHaveLength(0);
  });
  it("no client can write orders, items, shipments or history directly", async () => {
    for (const sql of [
      "update public.orders set status = 'delivered'", "delete from public.orders", "insert into public.order_status_history (order_id, to_status, actor_kind) values ('00000000-0000-0000-0000-000000000000', 'placed', 'customer')",
      "update public.checkouts set payment_status = 'paid'", "update public.orders set payment_status = 'paid'", "insert into public.shipments (order_id, carrier, tracking_number) values ('00000000-0000-0000-0000-000000000000', 'x', 'y')",
    ]) {
      for (const who of [alice, sA, admin]) expect(await failure(db, who, sql)).toMatch(/permission denied/);
    }
  });
  it("customers cannot use seller functions, sellers cannot use another seller's order, and non-owners cannot cancel", async () => {
    expect(await failure(db, alice, "select public.vendor_respond_order($1, 'accept', null)", [oB])).toMatch(/not_found/);
    expect(await failure(db, sA, "select public.vendor_respond_order($1, 'accept', null)", [oB])).toMatch(/not_found/);
    expect(await failure(db, bob, "select public.cancel_order($1, 'x')", [oB])).toMatch(/not_found/);
    expect(await failure(db, sB, "select public.cancel_order($1, 'x')", [oB])).toMatch(/not_found/);
    expect(await failure(db, alice, "select public.admin_cancel_order($1, 'x')", [oB])).toMatch(/forbidden/);
    await rpc(alice, "select public.cancel_order($1, 'tidy up')", [oB]);
  });
});

describe("seller fulfilment and shipment tracking", () => {
  let order: string;
  let before: number;
  beforeAll(async () => { before = await stock(vtC); order = await freshOrder(alice, vtC, vC, 2); });

  it("walks accept -> packed -> shipped -> in transit -> delivered, and the customer sees each step", async () => {
    expect(await stock(vtC)).toBe(before - 2);
    expect(await failure(db, sC, "select public.vendor_mark_packed($1)", [order])).toMatch(/invalid_status/); // not accepted yet
    await rpc(sC, "select public.vendor_respond_order($1, 'accept', 'We will pack it tomorrow')", [order]);
    expect(await status(order)).toBe("confirmed");
    expect(await failure(db, sC, "select public.vendor_respond_order($1, 'accept', null)", [order])).toMatch(/invalid_status/);
    expect(await failure(db, sC, "select public.vendor_ship_order($1, 'DTDC', 'AB123', null)", [order])).toMatch(/invalid_status/); // must be packed first
    await rpc(sC, "select public.vendor_mark_packed($1)", [order]);
    expect(await failure(db, sC, "select public.vendor_ship_order($1, '', '', null)", [order])).toMatch(/tracking_required/);
    await rpc(sC, "select public.vendor_ship_order($1, 'DTDC', 'AB123456', 'https://track.example.com/AB123456')", [order]);
    expect(await status(order)).toBe("shipped");
    const ship = await one<{ carrier: string; tracking_number: string; status: string; tracking_url: string }>("select * from public.shipments where order_id = $1", [order]);
    expect(ship).toMatchObject({ carrier: "DTDC", tracking_number: "AB123456", status: "shipped", tracking_url: "https://track.example.com/AB123456" });
    expect(await failure(db, sC, "select public.vendor_ship_order($1, 'X1', 'Y123', null)", [order])).toMatch(/invalid_status/);
    await rpc(sC, "select public.vendor_update_shipment($1, 'in_transit', 'Left the hub')", [order]);
    await rpc(sC, "select public.vendor_update_shipment($1, 'out_for_delivery', null)", [order]);
    expect(await failure(db, sC, "select public.vendor_update_shipment($1, 'shipped', null)", [order])).toMatch(/invalid_status/);
    expect(await status(order)).toBe("shipped");
    await rpc(sC, "select public.vendor_update_shipment($1, 'delivered', 'Handed over')", [order]);
    expect(await status(order)).toBe("delivered");
    expect(await failure(db, sC, "select public.vendor_update_shipment($1, 'failed', null)", [order])).toMatch(/invalid_status/);
    expect((await one<{ delivered_at: string | null }>("select delivered_at from public.orders where id = $1", [order])).delivered_at).not.toBeNull();
    // what the customer sees
    expect((await rpc<{ status: string }>(alice, "select status from public.orders where id = $1", [order]))[0].status).toBe("delivered");
    expect((await rpc<{ tracking_number: string }>(alice, "select tracking_number from public.shipments where order_id = $1", [order]))[0].tracking_number).toBe("AB123456");
    expect((await rpc<{ n: number }>(alice, "select count(*)::int as n from public.shipment_events e join public.shipments s on s.id = e.shipment_id where s.order_id = $1", [order]))[0].n).toBe(4);
    expect((await rpc<{ to_status: string }>(alice, "select to_status from public.order_status_history where order_id = $1 order by id", [order])).map((h) => h.to_status)).toEqual(["placed", "confirmed", "packed", "shipped", "delivered"]);
    expect((await all("select 1 from public.notifications where user_id = $1 and kind = 'order_status'", [alice])).length).toBeGreaterThanOrEqual(4);
  });
  it("records who did each step, and the shipment log is append-only", async () => {
    const kinds = (await all<{ actor_kind: string }>("select actor_kind from public.order_status_history where order_id = $1 order by id", [order])).map((h) => h.actor_kind);
    expect(kinds).toEqual(["customer", "vendor", "vendor", "vendor", "vendor"]);
    await expect(db.query("update public.shipment_events set note = 'x'")).rejects.toThrow(/shipment_log_is_append_only/);
    await expect(db.query("delete from public.shipment_events")).rejects.toThrow(/shipment_log_is_append_only/);
  });
  it("only the seller can see tracking they entered for their own order", async () => {
    expect(await rpc(sC, "select 1 from public.shipments where order_id = $1", [order])).toHaveLength(1);
    expect(await rpc(sA, "select 1 from public.shipments where order_id = $1", [order])).toHaveLength(0);
    expect(await rpc(bob, "select 1 from public.shipments")).toHaveLength(0);
  });
});

describe("rejection and cancellation put stock back exactly once", () => {
  it("a seller can reject with a reason, which restocks and hides the address", async () => {
    const s0 = await stock(vtA);
    const order = await freshOrder(alice, vtA, vA, 3);
    expect(await stock(vtA)).toBe(s0 - 3);
    expect(await failure(db, sA, "select public.vendor_respond_order($1, 'reject', null)", [order])).toMatch(/reason_required/);
    await rpc(sA, "select public.vendor_respond_order($1, 'reject', 'Out of season')", [order]);
    expect(await status(order)).toBe("rejected");
    expect(await stock(vtA)).toBe(s0);
    expect(await rpc(sA, "select 1 from public.order_shipping where order_id = $1", [order])).toHaveLength(0);
    expect(await failure(db, sA, "select public.vendor_respond_order($1, 'accept', null)", [order])).toMatch(/invalid_status/);
    expect(await failure(db, alice, "select public.cancel_order($1, 'x')", [order])).toMatch(/cannot_cancel/);
    expect(await stock(vtA)).toBe(s0);
  });
  it("a customer cancels a not-yet-accepted order immediately", async () => {
    const s0 = await stock(vtA);
    const order = await freshOrder(alice, vtA, vA, 2);
    expect((await rpc<{ r: string }>(alice, "select public.cancel_order($1, 'Changed my mind') as r", [order]))[0].r).toBe("cancelled");
    expect(await status(order)).toBe("cancelled");
    expect(await stock(vtA)).toBe(s0);
    expect((await one<{ stock_restored: boolean }>("select stock_restored from public.orders where id = $1", [order])).stock_restored).toBe(true);
    expect(await failure(db, admin, "select public.admin_cancel_order($1, 'again')", [order])).toMatch(/invalid_status/);
    expect(await stock(vtA)).toBe(s0);
  });
  it("after acceptance a cancellation is a request the seller decides; approval cancels and restocks, rejection needs a reason", async () => {
    const s0 = await stock(vtA);
    const order = await freshOrder(alice, vtA, vA, 1);
    await rpc(sA, "select public.vendor_respond_order($1, 'accept', null)", [order]);
    expect(await failure(db, alice, "select public.cancel_order($1, '')", [order])).toMatch(/reason_required/);
    expect((await rpc<{ r: string }>(alice, "select public.cancel_order($1, 'Found it elsewhere') as r", [order]))[0].r).toBe("requested");
    expect(await status(order)).toBe("confirmed");
    expect(await stock(vtA)).toBe(s0 - 1);
    expect(await failure(db, alice, "select public.cancel_order($1, 'Found it elsewhere again')", [order])).toMatch(/unique|duplicate/i);
    const req = (await one<{ id: string }>("select id from public.order_requests where order_id = $1 and kind = 'cancel'", [order])).id;
    expect(await failure(db, alice, "select public.decide_order_request($1, 'approve', null)", [req])).toMatch(/not_found/);
    expect(await failure(db, sB, "select public.decide_order_request($1, 'approve', null)", [req])).toMatch(/not_found/);
    expect(await failure(db, sA, "select public.decide_order_request($1, 'reject', null)", [req])).toMatch(/reason_required/);
    await rpc(sA, "select public.decide_order_request($1, 'approve', 'No problem')", [req]);
    expect(await status(order)).toBe("cancelled");
    expect(await stock(vtA)).toBe(s0);
    expect((await one<{ status: string }>("select status from public.order_requests where id = $1", [req])).status).toBe("completed");
  });
  it("a seller can decline a cancellation request, and a shipped order cannot be cancelled", async () => {
    const order = await freshOrder(alice, vtA, vA, 1);
    await rpc(sA, "select public.vendor_respond_order($1, 'accept', null)", [order]);
    await rpc(alice, "select public.cancel_order($1, 'Please cancel')", [order]);
    const req = (await one<{ id: string }>("select id from public.order_requests where order_id = $1", [order])).id;
    await rpc(sA, "select public.decide_order_request($1, 'reject', 'Already prepared')", [req]);
    expect(await status(order)).toBe("confirmed");
    await rpc(sA, "select public.vendor_mark_packed($1)", [order]);
    await rpc(sA, "select public.vendor_ship_order($1, 'DTDC', 'ZZ999', null)", [order]);
    expect(await failure(db, alice, "select public.cancel_order($1, 'too late')", [order])).toMatch(/cannot_cancel/);
    expect(await failure(db, admin, "select public.admin_cancel_order($1, 'too late')", [order])).toMatch(/invalid_status/);
    await rpc(sA, "select public.vendor_update_shipment($1, 'delivered', null)", [order]);
  });
  it("an administrator can cancel an order before dispatch, with a reason, and it restocks", async () => {
    const s0 = await stock(vtB);
    const order = await freshOrder(alice, vtB, vB, 2);
    expect(await failure(db, admin, "select public.admin_cancel_order($1, '')", [order])).toMatch(/reason_required/);
    await rpc(admin, "select public.admin_cancel_order($1, 'Seller closed for the season')", [order]);
    expect(await status(order)).toBe("cancelled");
    expect(await stock(vtB)).toBe(s0);
    expect((await all<{ actor_kind: string }>("select actor_kind from public.order_status_history where order_id = $1 and to_status = 'cancelled'", [order]))[0].actor_kind).toBe("admin");
  });
});

describe("returns and replacements follow the category policy, and say so when there is none", () => {
  let delivered: string; // a Plants order (category policy initially unconfigured)
  let deliveredTool: string; // a Tools order
  const deliver = async (order: string, seller: string) => {
    await rpc(seller, "select public.vendor_respond_order($1, 'accept', null)", [order]);
    await rpc(seller, "select public.vendor_mark_packed($1)", [order]);
    await rpc(seller, "select public.vendor_ship_order($1, 'DTDC', $2, null)", [order, `T${Math.random().toString(36).slice(2, 8)}`]);
    await rpc(seller, "select public.vendor_update_shipment($1, 'delivered', null)", [order]);
  };
  beforeAll(async () => {
    delivered = await freshOrder(alice, vtA, vA, 1);
    deliveredTool = await freshOrder(alice, vtB, vB, 1);
    const pending = delivered;
    expect(await failure(db, alice, "select public.request_return($1, 'return', 'Not as described', null)", [pending])).toMatch(/not_delivered/);
    await deliver(delivered, sA);
    await deliver(deliveredTool, sB);
  });
  it("with no policy configured the request is accepted for a human decision, and the customer is told", async () => {
    const id = (await rpc<{ id: string }>(alice, "select public.request_return($1, 'return', 'Leaves were damaged', 'Photos available') as id", [delivered]))[0].id;
    const r = await one<{ status: string; policy_note: string; kind: string }>("select status, policy_note, kind from public.order_requests where id = $1", [id]);
    expect(r).toMatchObject({ status: "requested", kind: "return" });
    expect(r.policy_note).toMatch(/No return policy is configured yet for: Plants, seeds and saplings/);
    expect(await failure(db, alice, "select public.request_return($1, 'return', 'Again please', null)", [delivered])).toMatch(/unique|duplicate/i);
    expect((await all("select 1 from public.notifications where user_id = $1 and kind = 'order_request'", [sA])).length).toBeGreaterThan(0);
  });
  it("a return and a replacement are separate requests; the seller approves, completes, or rejects with a note", async () => {
    const rep = (await rpc<{ id: string }>(alice, "select public.request_return($1, 'replacement', 'One plant arrived dead', null) as id", [delivered]))[0].id;
    expect(await failure(db, alice, "select public.decide_order_request($1, 'approve', null)", [rep])).toMatch(/not_found/);
    expect(await failure(db, sB, "select public.decide_order_request($1, 'approve', null)", [rep])).toMatch(/not_found/);
    expect(await failure(db, sA, "select public.decide_order_request($1, 'complete', null)", [rep])).toMatch(/invalid_status/);
    await rpc(sA, "select public.decide_order_request($1, 'approve', 'We will send a new one')", [rep]);
    await rpc(sA, "select public.decide_order_request($1, 'complete', 'Sent')", [rep]);
    expect((await one<{ status: string }>("select status from public.order_requests where id = $1", [rep])).status).toBe("completed");
    const ret = (await one<{ id: string }>("select id from public.order_requests where order_id = $1 and kind = 'return'", [delivered])).id;
    expect(await failure(db, sA, "select public.decide_order_request($1, 'reject', null)", [ret])).toMatch(/reason_required/);
    await rpc(admin, "select public.decide_order_request($1, 'reject', 'Outside what we can accept')", [ret]); // an administrator may decide too
    expect((await one<{ status: string; decided_by: string }>("select status, decided_by from public.order_requests where id = $1", [ret]))).toMatchObject({ status: "rejected", decided_by: admin });
  });
  it("an administrator-configured policy is enforced: not allowed, window, and within window", async () => {
    await rpc(admin, "insert into public.product_category_policies (category_id, returns_allowed, return_window_days, replacements_allowed, replacement_window_days, notes) values ($1, false, null, true, 7, 'Tools are not returnable')", [catTools]);
    expect(await failure(db, alice, "select public.request_return($1, 'return', 'Changed my mind', null)", [deliveredTool])).toMatch(/not_allowed_by_policy:Gardening tools/);
    await db.query("update public.orders set delivered_at = now() - interval '10 days' where id = $1", [deliveredTool]);
    expect(await failure(db, alice, "select public.request_return($1, 'replacement', 'Handle broke', null)", [deliveredTool])).toMatch(/window_expired:Gardening tools/);
    await db.query("update public.orders set delivered_at = now() - interval '3 days' where id = $1", [deliveredTool]);
    const id = (await rpc<{ id: string }>(alice, "select public.request_return($1, 'replacement', 'Handle broke', null) as id", [deliveredTool]))[0].id;
    expect((await one<{ policy_note: string }>("select policy_note from public.order_requests where id = $1", [id])).policy_note).toBe("Within the configured policy.");
  });
  it("only an administrator configures policies, everyone can read them, changes are audited, and the product page shows the policy", async () => {
    expect(await failure(db, sA, "insert into public.product_category_policies (category_id, returns_allowed) values ($1, true)", [catPlants])).toMatch(/row-level security/);
    expect(await rpc(alice, "update public.product_category_policies set returns_allowed = true returning category_id")).toHaveLength(0); // RLS: no row is updatable by a customer
    expect((await one<{ returns_allowed: boolean }>("select returns_allowed from public.product_category_policies")).returns_allowed).toBe(false);
    expect((await rpc(null, "select category_id from public.product_category_policies")).length).toBe(1);
    expect((await all("select 1 from public.audit_logs where entity_type = 'product_category_policies'")).length).toBeGreaterThan(0);
    const slug = (await one<{ slug: string }>("select slug from public.products where id = (select product_id from public.order_items where order_id = $1 limit 1)", [deliveredTool])).slug;
    const page = (await rpc<{ p: { return_policy: Record<string, unknown> | null; orders_enabled: boolean } }>(null, "select public.get_product_public($1) as p", [slug]))[0].p;
    expect(page.return_policy).toMatchObject({ configured: true, returns_allowed: false, replacements_allowed: true, replacement_window_days: 7 });
    expect(page.orders_enabled).toBe(true);
    const plantSlug = (await one<{ slug: string }>("select slug from public.products where id = $1", [pidA])).slug;
    expect((await rpc<{ p: { return_policy: unknown } }>(null, "select public.get_product_public($1) as p", [plantSlug]))[0].p.return_policy).toBeNull(); // Plants: not configured
  });
});

describe("disputes", () => {
  it("a customer can open one on their own order; the administrator resolves it; sellers and strangers cannot see it", async () => {
    const order = (await one<{ id: string }>("select id from public.orders where customer_id = $1 limit 1", [alice])).id;
    expect(await failure(db, bob, "select public.open_dispute($1, 'This is not my order but I am complaining')", [order])).toMatch(/not_found/);
    expect(await failure(db, alice, "select public.open_dispute($1, 'short')", [order])).toMatch(/reason_required/);
    const id = (await rpc<{ id: string }>(alice, "select public.open_dispute($1, 'The seller has not replied to my messages.') as id", [order]))[0].id;
    expect(await rpc(alice, "select 1 from public.order_disputes where id = $1", [id])).toHaveLength(1);
    expect(await rpc(bob, "select 1 from public.order_disputes")).toHaveLength(0);
    expect(await rpc(sA, "select 1 from public.order_disputes")).toHaveLength(0);
    expect(await rpc(admin, "select 1 from public.order_disputes where id = $1", [id])).toHaveLength(1);
    expect(await failure(db, alice, "select public.admin_resolve_dispute($1, 'resolved', 'x')", [id])).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.admin_resolve_dispute($1, 'resolved', null)", [id])).toMatch(/reason_required/);
    await rpc(admin, "select public.admin_resolve_dispute($1, 'in_review', null)", [id]);
    await rpc(admin, "select public.admin_resolve_dispute($1, 'resolved', 'Seller contacted the customer')", [id]);
    expect(await failure(db, admin, "select public.admin_resolve_dispute($1, 'dismissed', 'later')", [id])).toMatch(/invalid_status/);
    expect((await all("select 1 from public.notifications where user_id = $1 and kind = 'order_dispute'", [alice])).length).toBe(1);
  });
});

describe("financial integrity", () => {
  it("no order, checkout or function can ever record or imply a payment", async () => {
    expect((await all("select 1 from public.orders where payment_status <> 'unpaid'")).length).toBe(0);
    expect((await all("select 1 from public.checkouts where payment_status <> 'unpaid'")).length).toBe(0);
    expect(num((await one<{ n: string }>("select count(*) as n from public.payments")).n)).toBe(0);
    const defs = (await all<{ def: string }>("select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)",
      [["place_order", "cart_set_item", "vendor_respond_order", "vendor_mark_packed", "vendor_ship_order", "vendor_update_shipment", "cancel_order", "decide_order_request", "admin_cancel_order", "request_return", "restock_order"]])).map((r) => r.def);
    expect(defs).toHaveLength(11);
    for (const d of defs) expect(d).not.toMatch(/payment_status\s*=\s*'(paid|refunded|partially_refunded)'|set\s+payment_status/i);
  });
  it("every stock change from orders is logged and the ledger of movements adds up to the stock on hand", async () => {
    const rows = await all<{ id: string; stock_on_hand: number; total: string }>("select v.id, v.stock_on_hand, coalesce(sum(m.delta), 0) as total from public.product_variants v left join public.inventory_movements m on m.variant_id = v.id where v.track_inventory group by v.id");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(num(r.total)).toBe(r.stock_on_hand);
  });
  it("leaves the Nature Stay tables untouched", async () => {
    expect(num((await one<{ n: string }>("select count(*) as n from public.bookings")).n)).toBe(0);
    expect(num((await one<{ n: string }>("select count(*) as n from public.commission_ledger")).n)).toBe(0);
    expect(num((await one<{ n: string }>("select count(*) as n from public.host_settlements")).n)).toBe(0);
  });
  it("has RLS on every new table", async () => {
    const tables = ["customer_addresses", "cart_items", "checkouts", "orders", "order_shipping", "order_items", "order_status_history", "shipments", "shipment_events", "order_requests", "order_disputes", "product_category_policies"];
    const rows = await all<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname = any($1) and relkind = 'r'", [tables]);
    expect(rows).toHaveLength(tables.length);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
