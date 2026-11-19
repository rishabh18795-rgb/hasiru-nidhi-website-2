import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

/**
 * M3 product catalogue: categories, vendor-owned products / variants / images, append-only inventory, separate product approval,
 * public visibility rules and isolation between vendors. Real migrations, real rows, test identities.
 */
let db: Db;
let admin: string;
let customer: string;
let sellerA: string; // approved for products, delivers to 560xxx
let sellerB: string; // approved for products, no delivery areas yet
let servicesOnly: string; // approved for services only
let vendorA: string;
let vendorB: string;
let catPlants: number;

const flag = (key: string, value: boolean) => db.query("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);
const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const rpc = <T extends Record<string, unknown> = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) => as<T>(db, user, sql, params);
const saveProduct = async (user: string, p: Record<string, unknown>) => (await rpc<{ id: string }>(user, "select public.save_product($1::jsonb) as id", [JSON.stringify(p)]))[0].id;
const variant = async (user: string, p: Record<string, unknown>) => (await rpc<{ id: string }>(user, "select public.save_product_variant($1::jsonb) as id", [JSON.stringify(p)]))[0].id;
const image = async (user: string, product: string, vendor: string, name = "a.jpg") => (await rpc<{ id: string }>(user, "select public.register_product_image($1, $2, 'alt') as id", [product, `${vendor}/${product}/${name}`]))[0].id;
const review = (product: string, decision: string, reason: string | null = null) => rpc(admin, "select public.admin_review_product($1, $2, $3)", [product, decision, reason]);
const status = async (product: string) => (await one<{ status: string }>("select status from public.products where id = $1", [product])).status;
const BASE = (extra: Record<string, unknown> = {}) => ({ category_id: catPlants, name: "Tulsi sapling", summary: "A healthy tulsi sapling.", description: "A healthy tulsi sapling grown in an organic nursery and ready for planting at home.", brand: "Green Roots", attributes: [{ label: "Height", value: "20 cm" }], ...extra });

async function makeSeller(email: string, name: string, caps: string[]): Promise<{ user: string; vendor: string }> {
  const user = await createUser(db, email, { full_name: name });
  const vendor = (await rpc<{ id: string }>(user, "select public.save_vendor_profile($1::jsonb) as id", [JSON.stringify({
    business_name: name, business_type: "farm", contact_name: name, contact_email: email, contact_phone: "+919876543210", address_line: "1 Farm Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078" })]))[0].id;
  await rpc(user, "select public.submit_vendor_application($1::public.vendor_capability[])", [`{${caps.join(",")}}`]);
  await rpc(admin, "select public.admin_review_vendor($1, 'approve', null)", [vendor]);
  for (const c of caps) await rpc(admin, "select public.admin_review_capability($1, $2, 'approve', null)", [vendor, c]);
  return { user, vendor };
}

/** A complete, submittable product for a seller, optionally already approved. */
async function readyProduct(user: string, vendor: string, over: Record<string, unknown> = {}, opts: { approve?: boolean; stock?: number; price?: number; sku?: string } = {}): Promise<string> {
  const id = await saveProduct(user, BASE(over));
  await variant(user, { product_id: id, sku: opts.sku ?? `SKU-${id.slice(0, 6)}`, name: "Single plant", price_inr: opts.price ?? 120, initial_stock: opts.stock ?? 10 });
  await image(user, id, vendor);
  await rpc(user, "select public.submit_product($1)", [id]);
  if (opts.approve) await review(id, "approve");
  return id;
}

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@test.dev");
  await flag("marketplace_vendor_registration_enabled", true);
  customer = await createUser(db, "customer@test.dev", { full_name: "Customer" });
  ({ user: sellerA, vendor: vendorA } = await makeSeller("a@test.dev", "Green Roots Nursery", ["products"]));
  ({ user: sellerB, vendor: vendorB } = await makeSeller("b@test.dev", "Bee Farm", ["products"]));
  ({ user: servicesOnly } = await makeSeller("s@test.dev", "Gardeners Co", ["services"]));
  await rpc(sellerA, "select public.set_vendor_service_areas('delivery', array['560'])");
  catPlants = (await one<{ id: number }>("select id from public.product_categories where slug = 'plants-seeds-saplings'")).id;
});

describe("product categories", () => {
  it("seeds exactly the six categories from the brief, in order, readable by everyone", async () => {
    const rows = await rpc<{ name: string }>(null, "select name from public.product_categories order by sort_order");
    expect(rows.map((r) => r.name)).toEqual([
      "Plants, seeds and saplings", "Gardening tools and accessories", "Organic fertilisers and compost",
      "Handmade and eco-friendly products", "Farm produce and organic food", "Nature and lifestyle products",
    ]);
  });
  it("only an administrator can add, edit, disable or reorder; slugs never change; 'all' is reserved", async () => {
    expect(await failure(db, customer, "insert into public.product_categories (slug, name) values ('spices', 'Spices')")).toMatch(/row-level security/);
    expect(await rpc(sellerA, "update public.product_categories set name = 'X' where id = $1 returning id", [catPlants])).toHaveLength(0); // RLS: no row is visible to update
    await rpc(admin, "insert into public.product_categories (slug, name, description, sort_order) values ('spices', 'Spices and herbs', 'Whole spices', 70)");
    expect(await failure(db, admin, "update public.product_categories set slug = 'changed' where slug = 'spices'")).toMatch(/slug_immutable/);
    expect(await failure(db, admin, "insert into public.product_categories (slug, name) values ('all', 'Everything')")).toMatch(/check constraint/);
    await rpc(admin, "update public.product_categories set name = 'Spices & herbs' where slug = 'spices'");
    expect((await one<{ name: string }>("select name from public.product_categories where slug = 'spices'")).name).toBe("Spices & herbs");
    expect((await db.query("select 1 from public.audit_logs where entity_type = 'product_categories'")).rows.length).toBeGreaterThan(0);

    const ids = (await db.query<{ id: number }>("select id from public.product_categories order by sort_order")).rows.map((r) => r.id);
    expect(await failure(db, sellerA, "select public.admin_reorder_product_categories($1::bigint[])", [`{${ids.join(",")}}`])).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.admin_reorder_product_categories($1::bigint[])", [`{${ids.slice(1).join(",")}}`])).toMatch(/invalid_order/);
    await rpc(admin, "select public.admin_reorder_product_categories($1::bigint[])", [`{${[...ids].reverse().join(",")}}`]);
    expect((await one<{ slug: string }>("select slug from public.product_categories order by sort_order limit 1")).slug).toBe("spices");
  });
  it("a disabled category is hidden from the public but stays for owners", async () => {
    await rpc(admin, "update public.product_categories set is_active = false where slug = 'spices'");
    expect(await rpc(null, "select id from public.product_categories where slug = 'spices'")).toHaveLength(0);
    expect(await rpc(admin, "select id from public.product_categories where slug = 'spices'")).toHaveLength(1);
  });
});

describe("selling needs the products capability", () => {
  it("customers, services-only vendors and unknown users cannot create products", async () => {
    expect(await failure(db, customer, "select public.save_product($1::jsonb)", [JSON.stringify(BASE())])).toMatch(/not_found/);
    expect(await failure(db, servicesOnly, "select public.save_product($1::jsonb)", [JSON.stringify(BASE())])).toMatch(/capability_not_approved/);
    expect(await failure(db, null, "select public.save_product($1::jsonb)", [JSON.stringify(BASE())])).toMatch(/permission denied/);
  });
  it("suspending the capability stops further changes at once", async () => {
    const t = await makeSeller("t@test.dev", "Temp Seller", ["products"]);
    await saveProduct(t.user, BASE());
    await rpc(admin, "select public.admin_review_capability($1, 'products', 'suspend', 'Check')", [t.vendor]);
    expect(await failure(db, t.user, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ name: "Another one" }))])).toMatch(/capability_not_approved/);
  });
});

describe("products, specifications and ownership", () => {
  let id: string;
  it("creates a draft with a clean slug and trimmed specifications", async () => {
    id = await saveProduct(sellerA, BASE({ attributes: [{ label: " Height ", value: " 20 cm " }] }));
    const p = await one<{ status: string; slug: string; attributes: { label: string; value: string }[]; vendor_id: string }>("select status, slug, attributes, vendor_id from public.products where id = $1", [id]);
    expect(p.status).toBe("draft");
    expect(p.slug).toMatch(/^tulsi-sapling-[0-9a-f]{6}$/);
    expect(p.attributes).toEqual([{ label: "Height", value: "20 cm" }]);
    expect(p.vendor_id).toBe(vendorA);
  });
  it("validates name, category and specifications", async () => {
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ name: "ab" }))])).toMatch(/name_required/);
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ category_id: 9999 }))])).toMatch(/invalid_category/);
    const disabled = (await one<{ id: number }>("select id from public.product_categories where slug = 'spices'")).id;
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ category_id: disabled }))])).toMatch(/invalid_category/);
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ attributes: [{ label: "", value: "x" }] }))])).toMatch(/invalid_attributes/);
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ attributes: Array.from({ length: 21 }, (_, i) => ({ label: `L${i}`, value: "v" })) }))])).toMatch(/invalid_attributes/);
  });
  it("is isolated: another seller can neither read nor change it, shoppers see nothing, admins see everything", async () => {
    expect(await failure(db, sellerB, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ id, name: "Hijacked" }))])).toMatch(/not_found/);
    expect(await rpc(sellerB, "select id from public.products where id = $1", [id])).toHaveLength(0);
    expect(await rpc(customer, "select id from public.products")).toHaveLength(0);
    expect(await failure(db, null, "select id from public.products")).toMatch(/permission denied/);
    expect(await rpc(sellerA, "select id from public.products where id = $1", [id])).toHaveLength(1);
    expect((await rpc(admin, "select id from public.products")).length).toBeGreaterThan(0);
    expect(await failure(db, sellerA, "update public.products set status = 'approved' where id = $1", [id])).toMatch(/permission denied/);
    expect(await failure(db, sellerA, "insert into public.products (vendor_id, category_id, slug, name) values ($1, $2, 'x-slug', 'Direct insert')", [vendorA, catPlants])).toMatch(/permission denied/);
  });
});

describe("variants and inventory", () => {
  let product: string;
  let v1: string;
  beforeAll(async () => { product = await saveProduct(sellerA, BASE({ name: "Neem compost" })); });

  it("creates variants with size, weight and pot size options, and records opening stock", async () => {
    v1 = await variant(sellerA, { product_id: product, sku: "NC-1KG", name: "1 kg bag", options: { Weight: "1 kg", "Pack quantity": "1" }, price_inr: "149.50", weight_grams: 1000, initial_stock: 25 });
    const row = await one<{ stock_on_hand: number; price_inr: string; options: Record<string, string> }>("select stock_on_hand, price_inr, options from public.product_variants where id = $1", [v1]);
    expect(row.stock_on_hand).toBe(25);
    expect(Number(row.price_inr)).toBe(149.5);
    expect(row.options).toEqual({ Weight: "1 kg", "Pack quantity": "1" });
    expect((await db.query("select delta, balance_after, reason from public.inventory_movements where variant_id = $1", [v1])).rows).toEqual([{ delta: 25, balance_after: 25, reason: "initial" }]);
  });
  it("validates SKU, price, weight and options, and refuses duplicates in any letter case", async () => {
    const bad = (extra: Record<string, unknown>) => failure(db, sellerA, "select public.save_product_variant($1::jsonb)", [JSON.stringify({ product_id: product, sku: "NC-5KG", name: "5 kg", price_inr: 500, ...extra })]);
    expect(await bad({ sku: "bad sku!" })).toMatch(/invalid_sku/);
    expect(await bad({ price_inr: 0 })).toMatch(/invalid_price/);
    expect(await bad({ price_inr: "abc" })).toMatch(/invalid_price/);
    expect(await bad({ weight_grams: -5 })).toMatch(/invalid_weight/);
    expect(await bad({ options: { A: "1", B: "2", C: "3", D: "4", E: "5", F: "6" } })).toMatch(/invalid_options/);
    expect(await bad({ options: { Size: 5 } })).toMatch(/invalid_options/);
    expect(await bad({ sku: "nc-1kg" })).toMatch(/duplicate_sku/);
    expect(await bad({ name: "" })).toMatch(/variant_name_required/);
  });
  it("stock can change only through adjust_inventory, and every change is logged", async () => {
    await variant(sellerA, { id: v1, product_id: product, sku: "NC-1KG", name: "1 kg bag", price_inr: 155, initial_stock: 9999 }); // initial_stock is ignored on update
    expect((await one<{ stock_on_hand: number }>("select stock_on_hand from public.product_variants where id = $1", [v1])).stock_on_hand).toBe(25);
    expect(await failure(db, sellerA, "update public.product_variants set stock_on_hand = 999 where id = $1", [v1])).toMatch(/permission denied/);
    expect((await rpc<{ n: number }>(sellerA, "select public.adjust_inventory($1, 'add', 5, 'restock', 'New batch') as n", [v1]))[0].n).toBe(30);
    expect((await rpc<{ n: number }>(sellerA, "select public.adjust_inventory($1, 'add', -3, 'damaged', null) as n", [v1]))[0].n).toBe(27);
    expect((await rpc<{ n: number }>(sellerA, "select public.adjust_inventory($1, 'set', 40, 'correction', 'Counted') as n", [v1]))[0].n).toBe(40);
    expect((await db.query<{ delta: number; balance_after: number; reason: string }>("select delta, balance_after, reason from public.inventory_movements where variant_id = $1 order by id", [v1])).rows).toEqual([
      { delta: 25, balance_after: 25, reason: "initial" }, { delta: 5, balance_after: 30, reason: "restock" }, { delta: -3, balance_after: 27, reason: "damaged" }, { delta: 13, balance_after: 40, reason: "correction" },
    ]);
    expect(await failure(db, sellerA, "select public.adjust_inventory($1, 'add', -41, 'damaged', null)", [v1])).toMatch(/invalid_quantity/);
    expect(await failure(db, sellerA, "select public.adjust_inventory($1, 'set', 5, 'initial', null)", [v1])).toMatch(/invalid_quantity/);
    expect(await failure(db, sellerA, "select public.adjust_inventory($1, 'multiply', 5, 'restock', null)", [v1])).toMatch(/invalid_quantity/);
    expect((await rpc<{ n: number }>(sellerA, "select public.adjust_inventory($1, 'set', 40, 'correction', null) as n", [v1]))[0].n).toBe(40); // no change, no new movement
    expect((await db.query("select 1 from public.inventory_movements where variant_id = $1", [v1])).rows).toHaveLength(4);
  });
  it("the inventory log is append-only, even for the database owner", async () => {
    await expect(db.query("update public.inventory_movements set delta = 99")).rejects.toThrow(/inventory_log_is_append_only/);
    await expect(db.query("delete from public.inventory_movements")).rejects.toThrow(/inventory_log_is_append_only/);
    expect(await failure(db, sellerA, "delete from public.inventory_movements")).toMatch(/permission denied/);
  });
  it("another seller cannot touch this product's variants or stock, or read its history", async () => {
    expect(await failure(db, sellerB, "select public.adjust_inventory($1, 'add', 1, 'restock', null)", [v1])).toMatch(/not_found/);
    expect(await failure(db, sellerB, "select public.save_product_variant($1::jsonb)", [JSON.stringify({ product_id: product, sku: "X", name: "x", price_inr: 1 })])).toMatch(/not_found/);
    expect(await rpc(sellerB, "select id from public.product_variants")).toHaveLength(0);
    expect(await rpc(sellerB, "select id from public.inventory_movements")).toHaveLength(0);
    expect((await rpc(sellerA, "select id from public.inventory_movements where variant_id = $1", [v1])).length).toBe(4);
  });
  it("an untracked variant has no stock to adjust and is always in stock", async () => {
    const u = await variant(sellerA, { product_id: product, sku: "NC-SERVICE", name: "Made to order", price_inr: 99, track_inventory: false });
    expect(await failure(db, sellerA, "select public.adjust_inventory($1, 'add', 1, 'restock', null)", [u])).toMatch(/inventory_not_tracked/);
  });
  it("limits a product to 30 variants", async () => {
    const p = await saveProduct(sellerA, BASE({ name: "Many variants" }));
    for (let i = 0; i < 30; i++) await variant(sellerA, { product_id: p, sku: `V${i}`, name: `Variant ${i}`, price_inr: 10 });
    expect(await failure(db, sellerA, "select public.save_product_variant($1::jsonb)", [JSON.stringify({ product_id: p, sku: "V31", name: "Too many", price_inr: 10 })])).toMatch(/too_many_variants/);
  });
});

describe("images", () => {
  let product: string;
  beforeAll(async () => { product = await saveProduct(sellerA, BASE({ name: "Photo test plant" })); });
  it("only accepts paths inside the seller's own product folder", async () => {
    expect(await failure(db, sellerA, "select public.register_product_image($1, $2, null)", [product, `${vendorB}/${product}/a.jpg`])).toMatch(/forbidden/);
    expect(await failure(db, sellerA, "select public.register_product_image($1, $2, null)", [product, `${vendorA}/${vendorA}/a.jpg`])).toMatch(/forbidden/);
    expect(await failure(db, sellerA, "select public.register_product_image($1, $2, null)", [product, `${vendorA}/${product}/../x.jpg`])).toMatch(/forbidden/);
    expect(await failure(db, sellerB, "select public.register_product_image($1, $2, null)", [product, `${vendorB}/${product}/a.jpg`])).toMatch(/not_found/);
  });
  it("orders, limits (10) and removes images, and only for the owner", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push(await image(sellerA, product, vendorA, `${i}.jpg`));
    expect(await failure(db, sellerA, "select public.register_product_image($1, $2, null)", [product, `${vendorA}/${product}/11.jpg`])).toMatch(/too_many_images/);
    await rpc(sellerA, "select public.reorder_product_images($1, $2::uuid[])", [product, `{${[...ids].reverse().join(",")}}`]);
    expect((await one<{ id: string }>("select id from public.product_images where product_id = $1 order by sort_order limit 1", [product])).id).toBe(ids[9]);
    expect(await failure(db, sellerA, "select public.reorder_product_images($1, $2::uuid[])", [product, `{${ids.slice(1).join(",")}}`])).toMatch(/invalid_order/);
    expect(await failure(db, sellerB, "select public.delete_product_image($1)", [ids[0]])).toMatch(/not_found/);
    expect((await rpc<{ p: string }>(sellerA, "select public.delete_product_image($1) as p", [ids[0]]))[0].p).toBe(`${vendorA}/${product}/0.jpg`);
  });
});

describe("separate product approval", () => {
  it("cannot be submitted until complete, and says exactly what is missing", async () => {
    const p = await saveProduct(sellerB, BASE({ name: "Honey jar", description: "Too short" }));
    expect(await failure(db, sellerB, "select public.submit_product($1)", [p])).toMatch(/incomplete_product: description,images,variants,delivery_areas/);
    await variant(sellerB, { product_id: p, sku: "HJ-1", name: "250 g", price_inr: 300, initial_stock: 5 });
    await image(sellerB, p, vendorB);
    expect(await failure(db, sellerB, "select public.submit_product($1)", [p])).toMatch(/incomplete_product: description,delivery_areas/);
    await rpc(sellerB, "select public.set_vendor_service_areas('delivery', array['110001'])");
    await saveProduct(sellerB, BASE({ id: p, name: "Honey jar", description: "Raw forest honey harvested and bottled by a small beekeeping farm in Karnataka." }));
    await rpc(sellerB, "select public.submit_product($1)", [p]);
    expect(await status(p)).toBe("pending_review");
    expect((await db.query("select 1 from public.notifications where user_id = $1 and kind = 'product_submitted'", [admin])).rows.length).toBeGreaterThan(0);
  });
  it("an approved vendor's new product is NEVER public until an administrator approves it", async () => {
    await flag("marketplace_products_enabled", true);
    const p = await readyProduct(sellerA, vendorA, { name: "Pending marigold" });
    expect(await status(p)).toBe("pending_review");
    const pSlug = (await one<{ slug: string }>("select slug from public.products where id = $1", [p])).slug;
    expect((await rpc<{ r: unknown }>(null, "select public.get_product_public($1) as r", [pSlug]))[0].r).toBeNull();
    expect((await rpc<{ id: string }>(null, "select id from public.search_products(p_query => 'Pending marigold')")).length).toBe(0);
    await flag("marketplace_products_enabled", false);
  });
  it("locks the product while it is in review", async () => {
    const p = await readyProduct(sellerA, vendorA, { name: "Locked rose" });
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ id: p, name: "Locked rose 2" }))])).toMatch(/product_locked_in_review/);
    expect(await failure(db, sellerA, "select public.save_product_variant($1::jsonb)", [JSON.stringify({ product_id: p, sku: "ZZ", name: "z", price_inr: 5 })])).toMatch(/product_locked/);
    expect(await failure(db, sellerA, "select public.register_product_image($1, $2, null)", [p, `${vendorA}/${p}/z.jpg`])).toMatch(/product_locked/);
    expect(await failure(db, sellerA, "select public.submit_product($1)", [p])).toMatch(/invalid_status/);
  });
  it("only an administrator decides; reasons are required; request changes returns it as an editable draft", async () => {
    const p = await readyProduct(sellerA, vendorA, { name: "Review me basil" });
    expect(await failure(db, sellerA, "select public.admin_review_product($1, 'approve', null)", [p])).toMatch(/forbidden/);
    expect(await failure(db, customer, "select public.admin_review_product($1, 'approve', null)", [p])).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.admin_review_product($1, 'reject', null)", [p])).toMatch(/reason_required/);
    expect(await failure(db, admin, "select public.admin_review_product($1, 'suspend', 'x')", [p])).toMatch(/invalid_status/);
    await review(p, "request_changes", "Please add a clearer photo");
    expect(await status(p)).toBe("draft");
    expect((await one<{ rejection_reason: string }>("select rejection_reason from public.products where id = $1", [p])).rejection_reason).toBe("Please add a clearer photo");
    expect((await db.query("select 1 from public.notifications where user_id = $1 and kind = 'product_request_changes'", [sellerA])).rows).toHaveLength(1);
    await rpc(sellerA, "select public.submit_product($1)", [p]);
    await review(p, "reject", "Not suitable for the marketplace");
    expect(await status(p)).toBe("rejected");
    await image(sellerA, p, vendorA, "better.jpg"); // rejected products can be fixed and resubmitted
    await rpc(sellerA, "select public.submit_product($1)", [p]);
    await review(p, "approve");
    expect(await status(p)).toBe("approved");
    expect((await one<{ published_at: string | null; rejection_reason: string | null }>("select published_at, rejection_reason from public.products where id = $1", [p]))).toMatchObject({ rejection_reason: null });
    expect((await one<{ published_at: string | null }>("select published_at from public.products where id = $1", [p])).published_at).not.toBeNull();
  });
  it("cannot be approved if the vendor's capability was withdrawn meanwhile", async () => {
    const t = await makeSeller("t2@test.dev", "Withdrawn Seller", ["products"]);
    await rpc(t.user, "select public.set_vendor_service_areas('delivery', array['560'])");
    const p = await readyProduct(t.user, t.vendor, { name: "Late tomato" });
    await rpc(admin, "select public.admin_review_capability($1, 'products', 'suspend', 'Check')", [t.vendor]);
    expect(await failure(db, admin, "select public.admin_review_product($1, 'approve', null)", [p])).toMatch(/capability_not_approved/);
  });
});

describe("what shoppers can see", () => {
  let live: string;
  let slug: string;
  beforeAll(async () => {
    live = await readyProduct(sellerA, vendorA, { name: "Visible jasmine", summary: "Fragrant jasmine." }, { approve: true, stock: 7, price: 250 });
    slug = (await one<{ slug: string }>("select slug from public.products where id = $1", [live])).slug;
  });
  const pub = async () => (await rpc<{ r: Record<string, unknown> | null }>(null, "select public.get_product_public($1) as r", [slug]))[0].r;

  it("nothing is public while the module flag is OFF, even for an approved product", async () => {
    await flag("marketplace_products_enabled", false);
    expect(await pub()).toBeNull();
    expect((await rpc(null, "select id from public.search_products()")).length).toBe(0);
    const aSlug = (await one<{ slug: string }>("select slug from public.vendors where id = $1", [vendorA])).slug;
    expect((await rpc<{ v: unknown }>(null, "select public.get_vendor_store($1) as v", [aSlug]))[0].v).toBeNull();
    expect((await rpc<{ e: boolean }>(null, "select public.products_enabled() as e"))[0].e).toBe(false);
  });
  it("turning the flag ON exposes only approved products, with no stock numbers and no private data", async () => {
    await flag("marketplace_products_enabled", true);
    const p = await pub();
    expect(p).not.toBeNull();
    expect(p).toMatchObject({ name: "Visible jasmine", vendor: { business_name: "Green Roots Nursery" }, category: { slug: "plants-seeds-saplings" } });
    const text = JSON.stringify(p);
    expect(text).not.toMatch(/stock_on_hand|"stock"|contact_email|contact_phone|address_line|owner_id|tax_identifier/);
    const variants = (p as { variants: { price_inr: string; in_stock: boolean }[] }).variants;
    expect(variants).toHaveLength(1);
    expect(Number(variants[0].price_inr)).toBe(250);
    expect(variants[0].in_stock).toBe(true);
    expect((await rpc<{ id: string }>(null, "select id from public.search_products()")).map((r) => r.id)).toContain(live);
  });
  it("disappears when the product, category, vendor or capability stops being approved", async () => {
    await rpc(admin, "select public.admin_review_product($1, 'suspend', 'Pause')", [live]);
    expect(await pub()).toBeNull();
    await rpc(admin, "select public.admin_review_product($1, 'reinstate', null)", [live]);
    expect(await pub()).not.toBeNull();
    await db.query("update public.product_categories set is_active = false where id = $1", [catPlants]);
    expect(await pub()).toBeNull();
    await db.query("update public.product_categories set is_active = true where id = $1", [catPlants]);
    await rpc(admin, "select public.admin_review_capability($1, 'products', 'suspend', 'Check')", [vendorA]);
    expect(await pub()).toBeNull();
    expect((await rpc(null, "select id from public.search_products()")).map((r) => (r as { id: string }).id)).not.toContain(live);
    await rpc(admin, "select public.admin_review_capability($1, 'products', 'reinstate', null)", [vendorA]);
    await db.query("update public.profiles set is_suspended = true where id = $1", [sellerA]);
    expect(await pub()).toBeNull();
    await db.query("update public.profiles set is_suspended = false where id = $1", [sellerA]);
    expect(await pub()).not.toBeNull();
  });
  it("shows out-of-stock and paused products honestly instead of hiding the price", async () => {
    const v = (await one<{ id: string }>("select id from public.product_variants where product_id = $1", [live])).id;
    await rpc(sellerA, "select public.adjust_inventory($1, 'set', 0, 'correction', null)", [v]);
    expect(((await pub()) as { variants: { in_stock: boolean }[] }).variants[0].in_stock).toBe(false);
    expect((await rpc<{ in_stock: boolean }>(null, "select in_stock from public.search_products(p_query => 'Visible jasmine')"))[0].in_stock).toBe(false);
    expect(await rpc(null, "select id from public.search_products(p_query => 'Visible jasmine', p_in_stock => true)")).toHaveLength(0);
    await rpc(sellerA, "select public.adjust_inventory($1, 'set', 7, 'restock', null)", [v]);
    await rpc(sellerA, "select public.set_product_availability($1, false)", [live]);
    expect(((await pub()) as { is_available: boolean }).is_available).toBe(false);
    expect(await rpc(null, "select id from public.search_products(p_query => 'Visible jasmine', p_in_stock => true)")).toHaveLength(0);
    await rpc(sellerA, "select public.set_product_availability($1, true)", [live]);
    expect(await failure(db, sellerB, "select public.set_product_availability($1, false)", [live])).toMatch(/not_found/);
  });
  it("sends a live product back for review when its content or photos change, but not for price or stock", async () => {
    const v = (await one<{ id: string }>("select id from public.product_variants where product_id = $1", [live])).id;
    await variant(sellerA, { id: v, product_id: live, sku: (await one<{ sku: string }>("select sku from public.product_variants where id = $1", [v])).sku, name: "Single plant", price_inr: 275 });
    await rpc(sellerA, "select public.adjust_inventory($1, 'add', 3, 'restock', null)", [v]);
    expect(await status(live)).toBe("approved");
    expect(Number(((await pub()) as { variants: { price_inr: string }[] }).variants[0].price_inr)).toBe(275);
    const img = (await one<{ id: string }>("select id from public.product_images where product_id = $1", [live])).id;
    expect(await failure(db, sellerA, "select public.delete_product_image($1)", [img])).toMatch(/last_image/);
    await saveProduct(sellerA, BASE({ id: live, name: "Visible jasmine", summary: "Fragrant jasmine.", description: (await one<{ description: string }>("select description from public.products where id = $1", [live])).description }));
    expect(await status(live)).toBe("approved"); // identical content: still live
    await saveProduct(sellerA, BASE({ id: live, name: "Visible jasmine plant", summary: "Fragrant jasmine." }));
    expect(await status(live)).toBe("pending_review");
    expect(await pub()).toBeNull();
    await review(live, "approve");
    await image(sellerA, live, vendorA, "extra.jpg");
    expect(await status(live)).toBe("pending_review");
    await review(live, "approve");
    expect(await pub()).not.toBeNull();
  });
  it("archives and restores (restored products start again as drafts)", async () => {
    const p = await readyProduct(sellerA, vendorA, { name: "Archive me fern" }, { approve: true });
    await rpc(sellerA, "select public.archive_product($1)", [p]);
    expect(await status(p)).toBe("archived");
    expect(await failure(db, sellerA, "select public.save_product($1::jsonb)", [JSON.stringify(BASE({ id: p, name: "Archive me fern 2" }))])).toMatch(/invalid_status/);
    expect(await failure(db, sellerB, "select public.restore_product($1)", [p])).toMatch(/not_found/);
    await rpc(sellerA, "select public.restore_product($1)", [p]);
    expect(await status(p)).toBe("draft");
  });
  it("featuring is admin only and only for approved products", async () => {
    expect(await failure(db, sellerA, "select public.admin_set_product_featured($1, true)", [live])).toMatch(/forbidden/);
    await rpc(admin, "select public.admin_set_product_featured($1, true)", [live]);
    expect((await rpc<{ id: string }>(null, "select id from public.search_products(p_featured => true)")).map((r) => r.id)).toEqual([live]);
    const draft = await saveProduct(sellerA, BASE({ name: "Draft only" }));
    expect(await failure(db, admin, "select public.admin_set_product_featured($1, true)", [draft])).toMatch(/invalid_status/);
    await review(live, "suspend", "Pause");
    expect((await one<{ is_featured: boolean }>("select is_featured from public.products where id = $1", [live])).is_featured).toBe(false);
    await review(live, "reinstate");
  });
});

describe("search, filters, PIN availability", () => {
  const names = async (sql: string, params: unknown[] = []) => (await rpc<{ name: string }>(null, sql, params)).map((r) => r.name);
  beforeAll(async () => {
    await review((await one<{ id: string }>("select id from public.products where name = 'Review me basil'")).id, "suspend", "Keep the search fixtures predictable");
    await readyProduct(sellerA, vendorA, { name: "Alpha compost", category_id: (await one<{ id: number }>("select id from public.product_categories where slug = 'organic-fertilisers-compost'")).id }, { approve: true, price: 80 });
    await readyProduct(sellerA, vendorA, { name: "Beta trowel", category_id: (await one<{ id: number }>("select id from public.product_categories where slug = 'gardening-tools-accessories'")).id }, { approve: true, price: 450 });
    await readyProduct(sellerB, vendorB, { name: "Gamma 100% honey" }, { approve: true, price: 300 });
  });
  it("finds by text across name, category and seller, and treats wildcards literally", async () => {
    expect(await names("select name from public.search_products(p_query => 'trowel')")).toEqual(["Beta trowel"]);
    expect(await names("select name from public.search_products(p_query => 'fertilisers')")).toEqual(["Alpha compost"]);
    expect((await names("select name from public.search_products(p_query => 'bee farm')")).sort()).toEqual(["Gamma 100% honey"]);
    expect(await names("select name from public.search_products(p_query => '%')")).toEqual(["Gamma 100% honey"]);
    expect(await names("select name from public.search_products(p_query => '_')")).toEqual([]);
  });
  it("filters by category, seller and price, and sorts", async () => {
    expect(await names("select name from public.search_products(p_category => 'gardening-tools-accessories')")).toEqual(["Beta trowel"]);
    const bSlug = (await one<{ slug: string }>("select slug from public.vendors where id = $1", [vendorB])).slug;
    expect(await names("select name from public.search_products(p_vendor => $1)", [bSlug])).toEqual(["Gamma 100% honey"]);
    expect((await names("select name from public.search_products(p_min => 100, p_max => 400)")).sort()).toEqual(["Gamma 100% honey", "Visible jasmine plant"]);
    expect(await names("select name from public.search_products(p_sort => 'price_asc', p_max => 500)")).toEqual(["Alpha compost", "Visible jasmine plant", "Gamma 100% honey", "Beta trowel"]);
    expect((await names("select name from public.search_products(p_sort => 'price_desc')"))[0]).toBe("Beta trowel");
    expect((await names("select name from public.search_products(p_sort => 'name')"))[0]).toBe("Alpha compost");
  });
  it("paginates with a stable total", async () => {
    const page1 = await rpc<{ total_count: string }>(null, "select total_count from public.search_products(p_limit => 2, p_offset => 0)");
    const page2 = await rpc<{ name: string }>(null, "select name from public.search_products(p_limit => 2, p_offset => 2)");
    expect(page1).toHaveLength(2);
    expect(Number(page1[0].total_count)).toBe(4);
    expect(page2).toHaveLength(2);
    expect(await rpc(null, "select 1 from public.search_products(p_limit => 1000)")).toHaveLength(4); // clamped to what exists, never unbounded
  });
  it("PIN search lists only products whose seller delivers there, by exact PIN or prefix", async () => {
    expect((await names("select name from public.search_products(p_pin => '560078')")).sort()).toEqual(["Alpha compost", "Beta trowel", "Visible jasmine plant"]);
    expect(await names("select name from public.search_products(p_pin => '110001')")).toEqual(["Gamma 100% honey"]);
    expect(await names("select name from public.search_products(p_pin => '700001')")).toEqual([]);
  });
  it("answers delivery checks as yes, no or unknown, and refuses non-public products", async () => {
    const jasmine = (await one<{ id: string }>("select id from public.products where name = 'Visible jasmine plant'")).id;
    const honey = (await one<{ id: string }>("select id from public.products where name = 'Gamma 100% honey'")).id;
    const check = async (id: string, pin: string) => (await rpc<{ r: string }>(null, "select public.check_product_delivery($1, $2) as r", [id, pin]))[0].r;
    expect(await check(jasmine, "560001")).toBe("yes");
    expect(await check(jasmine, "110001")).toBe("no");
    expect(await check(honey, "110001")).toBe("yes");
    await rpc(sellerB, "select public.set_vendor_service_areas('delivery', array[]::text[])");
    expect(await check(honey, "110001")).toBe("unknown");
    await rpc(sellerB, "select public.set_vendor_service_areas('delivery', array['110'])");
    expect(await failure(db, null, "select public.check_product_delivery($1, '12345')", [jasmine])).toMatch(/invalid_pin/);
    const draft = (await one<{ id: string }>("select id from public.products where name = 'Draft only'")).id;
    expect(await failure(db, null, "select public.check_product_delivery($1, '560001')", [draft])).toMatch(/not_found/);
  });
  it("vendor store details exist only for approved sellers and never leak contact data", async () => {
    const aSlug = (await one<{ slug: string }>("select slug from public.vendors where id = $1", [vendorA])).slug;
    const sSlug = (await one<{ slug: string }>("select slug from public.vendors where owner_id = $1", [servicesOnly])).slug;
    const store = (await rpc<{ s: Record<string, unknown> | null }>(null, "select public.get_vendor_store($1) as s", [aSlug]))[0].s;
    expect(store).toMatchObject({ business_name: "Green Roots Nursery" });
    expect(JSON.stringify(store)).not.toMatch(/contact_email|contact_phone|address_line|tax_identifier|owner_id/);
    expect((await rpc<{ s: unknown }>(null, "select public.get_vendor_store($1) as s", [sSlug]))[0].s).toBeNull();
  });
});

describe("structure and existing data", () => {
  it("has RLS on every new table and no client write grants", async () => {
    const tables = ["product_categories", "products", "product_variants", "product_images", "inventory_movements"];
    const rows = (await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname = any($1) and relkind = 'r'", [tables])).rows;
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    const grants = (await db.query<{ n: string }>("select count(*) as n from information_schema.role_table_grants where table_name in ('products','product_variants','product_images','inventory_movements') and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE')")).rows[0].n;
    expect(Number(grants)).toBe(0);
  });
  it("leaves the Stays tables and ledger untouched", async () => {
    expect(Number((await one<{ n: string }>("select count(*) as n from public.commission_ledger")).n)).toBe(0);
    expect(Number((await one<{ n: string }>("select count(*) as n from public.bookings")).n)).toBe(0);
  });
});
