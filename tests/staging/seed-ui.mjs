// Seeds three approved, in-stock products (one per test seller) on the STAGING project for the browser tests. Staging only.
import fs from "node:fs";
import path from "node:path";
import { loadEnv, clients, signedIn, must, ROOT_DIR } from "./lib.mjs";

const JPG = () => fs.readFileSync(path.join(ROOT_DIR, "public/images/gardening/marigold-flowers-garden-karnataka.jpg"));

export async function seedFixtures(label) {
  const env = loadEnv();
  const c = clients(env);
  const svc = c.service;
  await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_products_enabled", "marketplace_orders_enabled"]);
  await svc.from("product_category_policies").delete().neq("category_id", 0); // start every run with NO return policy configured
  const admin = await signedIn(env, c, "admin@staging.test", "Staging Admin");
  const run = `${label}-${Date.now().toString(36)}`;
  const out = { run, products: {} };
  const defs = {
    A: { email: "seller-a@staging.test", cat: "plants-seeds-saplings", name: "UI Tulsi sapling", variants: [["Small pot", 500], ["Medium pot", 700]] },
    B: { email: "seller-b@staging.test", cat: "organic-fertilisers-compost", name: "UI Neem compost", variants: [["1 kg bag", 500]] },
    C: { email: "seller-c@staging.test", cat: "gardening-tools-accessories", name: "UI Hand trowel", variants: [["Standard", 250]] },
  };
  for (const [k, d] of Object.entries(defs)) {
    const u = await signedIn(env, c, d.email, `Staging Seller ${k}`);
    const vendor = (await svc.from("vendors").select("id, status").eq("owner_id", u.id).maybeSingle()).data;
    if (!vendor || vendor.status !== "approved") throw new Error(`Seller ${k} is not onboarded: run "node tests/staging/workflow.mjs" once first.`);
    await svc.from("vendor_service_areas").delete().eq("vendor_id", vendor.id).eq("scope", "delivery");
    must(await u.client.rpc("set_vendor_service_areas", { p_scope: "delivery", p_codes: ["560"] }), "areas");
    const cat = (await svc.from("product_categories").select("id").eq("slug", d.cat).single()).data.id;
    const name = `${d.name} ${run}`;
    const pid = must(await u.client.rpc("save_product", { p: { category_id: cat, name, summary: `${d.name} for browser tests.`, description: `${d.name}: a staging product used by the browser tests, with a long enough description.`, attributes: [{ label: "Origin", value: "Staging farm" }] } }), "save_product");
    const variants = [];
    for (const [i, [vname, price]] of d.variants.entries()) {
      const vid = must(await u.client.rpc("save_product_variant", { p: { product_id: pid, sku: `UI-${k}-${i}-${run}`.slice(0, 40), name: vname, price_inr: price, initial_stock: 30 } }), "variant");
      variants.push({ id: vid, name: vname, price });
    }
    const imgPath = `${vendor.id}/${pid}/${run}.jpg`;
    must(await u.client.storage.from("product-images").upload(imgPath, JPG(), { contentType: "image/jpeg" }), "image");
    must(await u.client.rpc("register_product_image", { p_product: pid, p_path: imgPath, p_alt: name }), "register image");
    must(await u.client.rpc("submit_product", { p_product: pid }), "submit");
    must(await admin.client.rpc("admin_review_product", { p_product: pid, p_decision: "approve", p_reason: null }), "approve");
    const slug = (await svc.from("products").select("slug").eq("id", pid).single()).data.slug;
    out.products[k] = { id: pid, slug, name, vendorId: vendor.id, variants };
  }
  const cust = await signedIn(env, c, "customer@staging.test", "Staging Customer");
  await svc.from("cart_items").delete().eq("user_id", cust.id);
  await svc.from("customer_addresses").delete().eq("user_id", cust.id);
  out.password = env.STAGING_TEST_PASSWORD;
  out.customerId = cust.id;
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("seed-ui.mjs")) {
  const f = await seedFixtures(process.argv[2] ?? "manual");
  fs.writeFileSync(path.join(ROOT_DIR, "tests/staging/.fixtures.json"), JSON.stringify({ ...f, password: undefined }, null, 2));
  console.log("seeded", Object.values(f.products).map((p) => p.name).join(", "));
}
