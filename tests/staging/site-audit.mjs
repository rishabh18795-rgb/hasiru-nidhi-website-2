// Whole-site audit against the staging-backed app (default http://localhost:3401): every public, customer, vendor, host and admin page,
// on a desktop and a phone viewport. Reports real defects only: HTTP errors, console errors, broken images, sideways scrolling, axe violations
// (serious or critical). Saves screenshots to /tmp/audit for review. STAGING ONLY.
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium, devices } from "@playwright/test";
import { loadEnv, clients } from "./lib.mjs";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3401";
const env = loadEnv();
const c = clients(env);
const pw = env.STAGING_TEST_PASSWORD;
const ONLY = process.env.AUDIT_ONLY; // e.g. "admin" to run one role

const prod = (await c.anon.rpc("search_products", { p_limit: 1 })).data[0];
const svcRow = (await c.anon.rpc("search_services", { p_limit: 1, p_pricing: "fixed" })).data[0];
const stay = (await c.service.from("properties").select("slug").eq("slug", "staging-cottage-demo").maybeSingle()).data;
const anyReq = (await c.service.from("service_requests").select("id").limit(1).maybeSingle()).data;
const anyOrder = (await c.service.from("orders").select("id").limit(1).maybeSingle()).data;

const ROUTES = {
  anon: ["/", "/stays", stay ? `/stays/${stay.slug}` : null, "/nature-stay", "/experiences", "/packages", "/gardening", "/gardening-landscaping", "/landscaping", "/cycling", "/gallery", "/about", "/faq", "/contact", "/blog",
    "/pricing", "/become-a-host", "/become-a-vendor", "/list-your-property", "/sign-in", "/sign-up", "/forgot-password", "/terms", "/privacy", "/cancellation-policy",
    "/shop", "/shop/all", `/shop/${prod.category_slug}`, `/shop/p/${prod.slug}`, `/vendors/${prod.vendor_slug}`, "/services", `/services/${svcRow.slug}`, "/services?pricing=fixed&pin=560078", "/shop/all?q=neem", "/no-such-page"],
  customer: ["/dashboard", "/dashboard/bookings", "/dashboard/orders", anyOrder ? `/dashboard/orders/${anyOrder.id}` : null, "/dashboard/requests", anyReq ? `/dashboard/requests/${anyReq.id}` : null, "/dashboard/addresses", "/dashboard/saved", "/dashboard/notifications", "/dashboard/profile", "/cart", "/checkout"],
  vendor: ["/vendor", "/vendor/profile", "/vendor/verification", "/vendor/coverage", "/vendor/products", "/vendor/products/new", "/vendor/orders", "/vendor/inventory", "/vendor/services", "/vendor/services/new", "/vendor/service-requests", "/vendor/availability"],
  host: ["/host", "/host/properties", "/host/bookings", "/host/earnings", "/host/calendar", "/host/profile"],
  admin: ["/admin", "/admin/marketplace", "/admin/vendors", "/admin/products", "/admin/product-categories", "/admin/orders", "/admin/order-policies", "/admin/services", "/admin/service-categories", "/admin/service-requests", "/admin/marketplace-commission",
    "/admin/properties", "/admin/hosts", "/admin/customers", "/admin/bookings", "/admin/payments", "/admin/commission", "/admin/settlements", "/admin/gardening", "/admin/enquiries", "/admin/reviews", "/admin/reports", "/admin/catalog", "/admin/settings", "/admin/audit-logs"],
};
const LOGIN = { customer: "customer@staging.test", vendor: "seller-a@staging.test", host: "host@staging.test", admin: "admin@staging.test" };
const VIEWPORTS = { desktop: { viewport: { width: 1366, height: 850 } }, mobile: { ...devices["Pixel 7"] } };

const issues = [];
const add = (vp, role, route, kind, detail) => issues.push({ vp, role, route, kind, detail });
fs.mkdirSync("/tmp/audit", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });

for (const [vp, opts] of Object.entries(VIEWPORTS)) {
  for (const role of Object.keys(ROUTES)) {
    if (ONLY && ONLY !== role) continue;
    const ctx = await browser.newContext({ ...opts, baseURL: BASE });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(`pageerror: ${e.message.slice(0, 160)}`));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of (401|403|404)/.test(m.text())) errs.push(`console: ${m.text().slice(0, 160)}`); });
    if (role !== "anon") {
      await page.goto("/sign-in");
      await page.locator("#email").fill(LOGIN[role]);
      await page.locator("#password").fill(pw);
      await page.getByRole("button", { name: /sign in/i }).first().click();
      await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30000 }).catch(() => add(vp, role, "/sign-in", "login", "could not sign in"));
    }
    for (const route of ROUTES[role].filter(Boolean)) {
      errs.length = 0;
      let status = 0;
      try {
        const res = await page.goto(route, { waitUntil: "load", timeout: 45000 });
        status = res?.status() ?? 0;
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(500);
      } catch (e) { add(vp, role, route, "navigation", String(e.message).slice(0, 120)); continue; }
      const expected404 = route === "/no-such-page";
      if (status >= 400 && !expected404) add(vp, role, route, "http", String(status));
      const final = new URL(page.url()).pathname;
      if (final !== route.split("?")[0] && !expected404) add(vp, role, route, "redirect", `→ ${final}`);
      const info = await page.evaluate(() => {
        const bad = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.loading?.includes("lazy-pending")).map((i) => i.currentSrc.slice(0, 90));
        const noAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).length;
        return { over: document.documentElement.scrollWidth - window.innerWidth, bad, noAlt, h1: document.querySelectorAll("h1").length, title: document.title };
      });
      if (info.over > 1) add(vp, role, route, "overflow", `${info.over}px sideways`);
      if (info.bad.length) add(vp, role, route, "broken-image", info.bad.join(" | "));
      if (info.noAlt) add(vp, role, route, "img-no-alt", `${info.noAlt} images`);
      if (info.h1 !== 1 && !expected404) add(vp, role, route, "h1", `${info.h1} h1 elements`);
      if (!info.title || info.title.length < 4) add(vp, role, route, "title", "missing");
      for (const e of [...new Set(errs)]) add(vp, role, route, "console", e);
      try {
        await page.evaluate(AXE);
        const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"], resultTypes: ["violations"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id}(${v.nodes.length})`));
        if (r.length) add(vp, role, route, "a11y", r.join(", "));
      } catch { /* axe cannot run on an error page */ }
      await page.screenshot({ path: `/tmp/audit/${vp}__${role}__${route.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}.png`, fullPage: false });
    }
    await ctx.close();
  }
}
await browser.close();
const byKind = {};
for (const i of issues) (byKind[i.kind] ??= []).push(i);
fs.writeFileSync("/tmp/audit/issues.json", JSON.stringify(issues, null, 1));
console.log(`\nAUDIT: ${issues.length} findings\n`);
for (const [k, list] of Object.entries(byKind)) {
  console.log(`== ${k} (${list.length})`);
  const seen = new Map();
  for (const i of list) { const key = `${i.route} :: ${i.detail}`; (seen.get(key) ?? seen.set(key, []).get(key)).push(`${i.vp[0]}/${i.role}`); }
  for (const [key, who] of [...seen].slice(0, 40)) console.log(`  ${key}  [${who.join(",")}]`);
}
