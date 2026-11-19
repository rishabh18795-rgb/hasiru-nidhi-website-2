// LOCAL VERIFICATION HARNESS - not part of the product and never deployed.
//
// Boots the project's REAL migrations in an in-process Postgres (PGlite), loads clearly-labelled FIXTURE rows through the REAL database
// functions (vendor application -> admin approval -> product submission -> admin approval), and exposes a minimal PostgREST-compatible HTTP
// front so the real Next.js Shop pages can be rendered against the real SQL (public functions, RLS, flags). It lets the public Shop be seen and
// tested without a Supabase project. Fixtures never touch any real database. A passing run proves rendering and the app <-> SQL contract only;
// it does NOT replace verification on a real Supabase environment.
//
// Usage: node tests/harness/shop-harness.mjs [port=54321]   (then run Next with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port>)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.argv[2] ?? 54321);

const db = new PGlite({ extensions: { btree_gist } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated, service_role; grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
const dir = path.join(ROOT, "supabase/migrations");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));

async function as(userId, sql, params = []) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
const user = async (email, name) => (await db.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id", [email, JSON.stringify({ full_name: name })])).rows[0].id;

// ---------------------------------------------------------------- FIXTURES (clearly fictional; harness only)
const admin = await user("admin@harness.local", "Harness Admin");
await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
await db.query("update public.platform_settings set value = 'true'::jsonb where key in ('marketplace_vendor_registration_enabled', 'marketplace_products_enabled')");
const IMAGES = ["gardening/assorted-vegetables-harvest-karnataka.jpg", "gardening/marigold-flowers-garden-karnataka.jpg", "gardening/smiling-woman-flower-bed-karnataka.jpg", "gardening/mixed-vegetable-harvest-karnataka.jpg", "gardening/child-with-leaf-garden-karnataka.jpg", "gallery/south-indian-breakfast-idli-sambar.jpg"];
const cat = async (slug) => (await db.query("select id from public.product_categories where slug = $1", [slug])).rows[0].id;

async function seller(email, name, city, pins) {
  const u = await user(email, name);
  const v = (await as(u, "select public.save_vendor_profile($1::jsonb) as id", [JSON.stringify({ business_name: name, business_type: "farm", description: `${name} (harness fixture).`, contact_name: name, contact_email: email, contact_phone: "+919800000000", address_line: "Harness Road", city, state: "Karnataka", postal_code: "560078" })]))[0].id;
  await as(u, "select public.submit_vendor_application('{products}'::public.vendor_capability[])");
  await as(admin, "select public.admin_review_vendor($1, 'approve', null)", [v]);
  await as(admin, "select public.admin_review_capability($1, 'products', 'approve', null)", [v]);
  await as(u, "select public.set_vendor_service_areas('delivery', $1::text[])", [`{${pins.join(",")}}`]);
  return { u, v };
}
let n = 0;
async function product(s, p) {
  const id = (await as(s.u, "select public.save_product($1::jsonb) as id", [JSON.stringify({ category_id: await cat(p.cat), name: p.name, summary: p.summary, description: p.description, brand: p.brand ?? null, attributes: p.attributes ?? [] })]))[0].id;
  for (const v of p.variants) await as(s.u, "select public.save_product_variant($1::jsonb)", [JSON.stringify({ product_id: id, ...v })]);
  for (let i = 0; i < (p.images ?? 2); i++) await as(s.u, "select public.register_product_image($1, $2, $3)", [id, `${s.v}/${id}/${n++ % IMAGES.length}-${i}.jpg`, p.name]);
  await as(s.u, "select public.submit_product($1)", [id]);
  if (!p.pending) await as(admin, "select public.admin_review_product($1, 'approve', null)", [id]);
  if (p.featured) await as(admin, "select public.admin_set_product_featured($1, true)", [id]);
  return id;
}
const A = await seller("a@harness.local", "Harness Green Roots Nursery", "Bengaluru", ["560"]);
const B = await seller("b@harness.local", "Harness Bee Farm", "Mysuru", ["570", "110001"]);
await product(A, { cat: "plants-seeds-saplings", name: "Tulsi sapling", summary: "A healthy tulsi sapling, ready for planting.", description: "Grown in an organic nursery and hardened off outdoors.\n\nWater regularly and keep in bright light.", brand: "Green Roots", featured: true, attributes: [{ label: "Height", value: "20 cm" }, { label: "Pot", value: "Biodegradable" }],
  variants: [{ sku: "TUL-S", name: "Small pot", price_inr: 120, initial_stock: 12, options: { "Pot size": "4 inch" } }, { sku: "TUL-M", name: "Medium pot", price_inr: 220, initial_stock: 0, options: { "Pot size": "6 inch" } }] });
await product(A, { cat: "plants-seeds-saplings", name: "Marigold seed packet", summary: "Open-pollinated marigold seeds.", description: "A packet of marigold seeds saved from our own beds. Sow directly in the soil.", variants: [{ sku: "MAR-50", name: "50 seeds", price_inr: 45, initial_stock: 100, weight_grams: 5 }] });
await product(A, { cat: "organic-fertilisers-compost", name: "Neem cake compost", summary: "Natural soil enricher.", description: "Neem cake compost for vegetable beds and pots.", featured: true, variants: [{ sku: "NC-1", name: "1 kg bag", price_inr: 149.5, initial_stock: 40, weight_grams: 1000 }, { sku: "NC-5", name: "5 kg bag", price_inr: 599, initial_stock: 8, weight_grams: 5000 }] });
await product(A, { cat: "gardening-tools-accessories", name: "Hand trowel", summary: "A sturdy hand trowel.", description: "Forged steel head with a wooden handle, for planting and weeding.", variants: [{ sku: "TRW-1", name: "Standard", price_inr: 450, initial_stock: 15 }] });
await product(B, { cat: "farm-produce-organic-food", name: "Forest honey", summary: "Raw honey from our own hives.", description: "Raw, unfiltered honey harvested from our hives.", variants: [{ sku: "HON-250", name: "250 g jar", price_inr: 300, initial_stock: 20, weight_grams: 250 }, { sku: "HON-500", name: "500 g jar", price_inr: 560, initial_stock: 10, weight_grams: 500 }] });
await product(B, { cat: "handmade-eco-friendly", name: "Coir doormat", summary: "Handwoven coir doormat.", description: "A durable doormat woven from coconut coir.", variants: [{ sku: "DM-1", name: "Natural", price_inr: 380, initial_stock: 6 }] });
await product(B, { cat: "nature-lifestyle", name: "Awaiting review item", summary: "Pending.", description: "This one stays pending and must never appear publicly.", pending: true, variants: [{ sku: "PND-1", name: "One", price_inr: 99, initial_stock: 1 }] });

// ---------------------------------------------------------------- minimal PostgREST-compatible front (public/anon reads only)
const procs = new Map((await db.query("select p.proname, p.proretset, pg_get_function_result(p.oid) as res from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'")).rows.map((r) => [r.proname, r]));
const TABLES = new Set(["platform_settings", "product_categories"]);
const ident = (s) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : (() => { throw new Error("bad identifier"); })());

function json(res, status, body, extra = {}) { res.writeHead(status, { "content-type": "application/json", ...extra }); res.end(JSON.stringify(body)); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname.startsWith("/storage/v1/object/public/product-images/")) {
      const idx = Number(url.pathname.match(/\/(\d+)-\d+\.jpg$/)?.[1] ?? 0);
      const file = path.join(ROOT, "public/images", IMAGES[idx % IMAGES.length]);
      res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" });
      return fs.createReadStream(file).pipe(res);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/") && req.method === "POST") {
      const fn = ident(url.pathname.split("/").pop());
      const meta = procs.get(fn);
      if (!meta) return json(res, 404, { message: `function ${fn} not found` });
      let body = ""; for await (const c of req) body += c;
      const args = body ? JSON.parse(body) : {};
      const keys = Object.keys(args).map(ident);
      const named = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
      const params = keys.map((k) => args[k]);
      const sql = meta.proretset ? `select to_jsonb(t) as r from public.${fn}(${named}) t` : `select public.${fn}(${named}) as r`;
      const rows = await as(null, sql, params);
      return json(res, 200, meta.proretset ? rows.map((r) => r.r) : rows[0]?.r ?? null);
    }
    const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (m && req.method === "GET" && TABLES.has(m[1])) {
      const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => (c === "*" ? "*" : ident(c.trim())));
      const where = []; const params = [];
      for (const [k, v] of url.searchParams) {
        if (["select", "order", "limit", "offset"].includes(k)) continue;
        const op = v.match(/^(eq|in)\.(.*)$/);
        if (!op) continue;
        if (op[1] === "eq") { params.push(op[2] === "true" ? true : op[2] === "false" ? false : op[2]); where.push(`${ident(k)}::text = $${params.length}::text`); }
        else { const vals = op[2].replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")); params.push(vals); where.push(`${ident(k)}::text = any($${params.length}::text[])`); }
      }
      const order = (url.searchParams.get("order") ?? "").split(",").filter(Boolean).map((o) => { const [c, d] = o.split("."); return `${ident(c)} ${d === "desc" ? "desc" : "asc"}`; }).join(", ");
      const rows = await as(null, `select ${cols.join(", ")} from public.${m[1]}${where.length ? ` where ${where.join(" and ")}` : ""}${order ? ` order by ${order}` : ""}`, params);
      return json(res, 200, rows);
    }
    json(res, 404, { message: "not implemented in the harness" });
  } catch (e) {
    json(res, 400, { message: String(e.message ?? e) });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`HARNESS_READY http://127.0.0.1:${PORT}`));
