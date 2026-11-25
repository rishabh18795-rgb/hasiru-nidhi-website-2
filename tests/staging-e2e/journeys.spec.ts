import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// STAGING ONLY. Three journeys through the real screens, each confirmed in the database:
//  A. the ORIGINAL Nature Stay flow: a guest requests a stay, the host accepts it from the host dashboard
//  B. verified reviews: a delivered order and a completed service are reviewed by the customer, moderated by the admin, then public
//  C. the admin finance view: nothing is ever shown as paid
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let svc: Any, env: Record<string, string> = {}, password = "";
const ctxs: BrowserContext[] = [];
let customer: Page, host: Page, admin: Page;
const clients: Record<string, Any> = {};
const tag = Date.now().toString(36);
const one = async (q: Any) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
const rpc = async (who: string, fn: string, args: Record<string, unknown> = {}) => one(clients[who].client.rpc(fn, args));
const day = (n: number) => new Date(Date.now() + n * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function newPage(browser: Browser): Promise<Page> {
  const u = test.info().project.use as Any;
  const ctx = await browser.newContext({ viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, baseURL: u.baseURL });
  ctxs.push(ctx);
  return ctx.newPage();
}
async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}
async function noSideScroll(page: Page, what: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${what} must not scroll sideways`).toBeLessThanOrEqual(1);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const lib = await import("../staging/lib.mjs");
  env = lib.loadEnv() as Record<string, string>;
  const c = lib.clients(env);
  svc = c.service;
  password = env.STAGING_TEST_PASSWORD;
  await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_products_enabled", "marketplace_orders_enabled", "marketplace_services_enabled"]);
  for (const [k, email, name] of [["customer", "customer@staging.test", "Staging Customer"], ["host", "host@staging.test", "Staging Host"], ["sellerB", "seller-b@staging.test", "Staging Seller B"], ["admin", "admin@staging.test", "Staging Admin"]]) clients[k] = await lib.signedIn(env, c, email, name);
  await svc.from("profiles").update({ role: "admin" }).eq("id", clients.admin.id);
  customer = await newPage(browser); host = await newPage(browser); admin = await newPage(browser);
});
test.afterAll(async () => { for (const c of ctxs) await c.close(); });

test("A1. the original Nature Stay: a guest requests a stay through the real booking panel", async () => {
  const prop = await one(svc.from("properties").select("id, slug").eq("slug", "staging-cottage-demo").single());
  // unique dates per run, and no open booking left over from an earlier (possibly failed) run: the product refuses overlapping open requests
  const offset = 200 + (parseInt(tag, 36) % 400);
  for (const b of (await one(svc.from("bookings").select("id, status").eq("property_id", prop.id).eq("traveller_id", clients.customer.id).in("status", ["requested", "confirmed"])))) {
    await rpc("customer", "cancel_booking", { p_booking: b.id, p_note: "Journey test cleanup" }).catch(() => undefined);
  }
  const [ci, co] = [day(offset), day(offset + 2)];
  await signIn(customer, "customer@staging.test", `/stays/${prop.slug}`);
  await customer.goto(`/stays/${prop.slug}`);
  await customer.waitForLoadState("networkidle");
  // controlled inputs can be reset if filled before the page has hydrated (slower on a phone): retry until the panel accepts the dates
  await expect(async () => {
    await customer.locator("#check_in").fill(ci);
    await customer.locator("#check_out").fill(co);
    await customer.locator("#message").fill(`Journey test ${tag}`);
    await expect(customer.locator("#check_in")).toHaveValue(ci);
    await expect(customer.locator("#check_out")).toHaveValue(co);
  }).toPass({ timeout: 20_000 });
  await noSideScroll(customer, "the stay page");
  await customer.getByRole("button", { name: "Request to book", exact: true }).click();
  await expect.poll(async () => (await svc.from("bookings").select("status").eq("property_id", prop.id).eq("message", `Journey test ${tag}`)).data?.[0]?.status, { timeout: 30_000 }).toBe("requested");
  (globalThis as Any).__stay = { propId: prop.id, ci };
});

test("A2. the host sees the request on the host dashboard and accepts it; the guest sees it confirmed", async () => {
  const { propId, ci } = (globalThis as Any).__stay;
  await signIn(host, "host@staging.test", "/host/bookings");
  await host.goto("/host/bookings");
  await expect(host.getByText(/staging cottage/i).first()).toBeVisible();
  await noSideScroll(host, "the host bookings page");
  const card = host.locator("div").filter({ hasText: `Journey test ${tag}` }).filter({ has: host.getByRole("button", { name: /accept/i }) }).last();
  await card.getByRole("button", { name: /accept/i }).click();
  await expect.poll(async () => (await svc.from("bookings").select("status").eq("property_id", propId).eq("check_in", ci)).data?.[0]?.status, { timeout: 30_000 }).toBe("confirmed");
  await customer.goto("/dashboard/bookings");
  await expect(customer.getByText(/confirmed/i).first()).toBeVisible();
  const b = (await svc.from("bookings").select("id").eq("property_id", propId).eq("check_in", ci)).data[0];
  await rpc("customer", "cancel_booking", { p_booking: b.id, p_note: "Journey test cleanup" });
});

test("B1. a delivered order and a completed service exist (created through the real functions)", async () => {
  const prod = await one(svc.from("products").select("id, slug, name").like("name", "Neem cake compost (demo)").eq("status", "approved").limit(1).single());
  const variant = (await one(svc.from("product_variants").select("id").eq("product_id", prod.id).eq("is_active", true).order("sort_order").limit(1)))[0].id;
  await rpc("customer", "cart_clear");
  // reuse the customer's saved address (the product limits an account to 10, and every run would otherwise add one)
  const saved = (await one(svc.from("customer_addresses").select("id").eq("user_id", clients.customer.id).order("created_at").limit(1)))[0];
  const addr = saved?.id ?? await rpc("customer", "save_address", { p: { full_name: "Staging Customer", phone: "9876500000", line1: "12 Rose Street", city: "Bengaluru", state: "Karnataka", postal_code: "560078" } });
  await rpc("customer", "cart_set_item", { p_variant: variant, p_quantity: 1 });
  const checkout = await rpc("customer", "place_order", { p_address: addr, p_key: `rv-${tag}` });
  const order = (await one(svc.from("orders").select("id").eq("checkout_id", checkout).single())).id;
  await rpc("sellerB", "vendor_respond_order", { p_order: order, p_decision: "accept" });
  await rpc("sellerB", "vendor_mark_packed", { p_order: order });
  await rpc("sellerB", "vendor_ship_order", { p_order: order, p_carrier: "DTDC", p_tracking: `TRK${tag}` });
  await rpc("sellerB", "vendor_update_shipment", { p_order: order, p_status: "delivered" });
  const svcRow = await one(svc.from("services").select("id, slug").like("name", "Plant health check (demo)").eq("status", "approved").limit(1).single());
  const req = await rpc("customer", "request_service", { p: { service_id: svcRow.id, quantity: 1, customer_name: "Staging Customer", phone: "9876500000", address_line: "12 Rose Street", city: "Bengaluru", pin: "560078" }, p_key: `rv-svc-${tag}` });
  await rpc("sellerB", "provider_respond_service_request", { p_request: req, p_decision: "accept" });
  await rpc("sellerB", "provider_complete_service", { p_request: req });
  (globalThis as Any).__rv = { prod, order, svcRow, req };
});

test("B2. the customer reviews the delivered product; it is pending and NOT public", async () => {
  const { prod, order } = (globalThis as Any).__rv;
  await customer.goto(`/dashboard/orders/${order}`); // already signed in from journey A
  await customer.waitForLoadState("networkidle");
  await customer.getByText("Write a review").first().click();
  await customer.getByLabel(/Rating for/).selectOption("5");
  await customer.getByLabel("Your review").fill(`Healthy compost, arrived well packed. ${tag}`);
  await noSideScroll(customer, "the order page with the review form");
  await customer.getByRole("button", { name: "Submit review" }).click();
  await expect(customer.getByText(/will appear once it has been checked/i)).toBeVisible({ timeout: 20_000 });
  await customer.reload(); // the next visit shows a persistent status line instead of the form
  await expect(customer.getByTestId("my-review")).toContainText("waiting for our team to check it");
  expect((await one(svc.from("marketplace_reviews").select("status").eq("product_id", prod.id).like("body", `%${tag}`)))[0].status).toBe("pending");
  await customer.goto(`/shop/p/${prod.slug}`);
  await expect(customer.getByText(tag)).toHaveCount(0);
});

test("B3. the customer reviews the completed service the same way", async () => {
  const { svcRow, req } = (globalThis as Any).__rv;
  await customer.goto(`/dashboard/requests/${req}`);
  await customer.getByLabel(/Rating for/).selectOption("4");
  await customer.getByLabel("Your review").fill(`Thorough plant check and good advice. ${tag}`);
  await customer.getByRole("button", { name: "Submit review" }).click();
  await expect(customer.getByText(/will appear once it has been checked/i)).toBeVisible({ timeout: 20_000 });
  await customer.reload();
  await expect(customer.getByTestId("my-review")).toContainText("waiting for our team to check it");
  expect((await one(svc.from("marketplace_reviews").select("status").eq("service_id", svcRow.id).like("body", `%${tag}`)))[0].status).toBe("pending");
});

test("B4. the administrator moderates both reviews; they become public with first name only and a verified label", async () => {
  const { prod, svcRow } = (globalThis as Any).__rv;
  await signIn(admin, "admin@staging.test", "/admin/marketplace-reviews");
  await admin.goto("/admin/marketplace-reviews");
  await noSideScroll(admin, "the review queue");
  for (const text of [`Healthy compost, arrived well packed. ${tag}`, `Thorough plant check and good advice. ${tag}`]) {
    const card = admin.locator("li").filter({ hasText: text });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Apply" }).click();
    // the outcome that matters is in the database; the queue then drops the item (or shows the confirmation until the next load)
    await expect.poll(async () => (await svc.from("marketplace_reviews").select("status").eq("body", text)).data?.[0]?.status, { timeout: 30_000 }).toBe("approved");
  }
  const pub = await customer.context().newPage();
  await pub.goto(`/shop/p/${prod.slug}`);
  await expect(pub.getByTestId("review").filter({ hasText: tag })).toContainText("Verified purchase");
  await expect(pub.getByTestId("review").filter({ hasText: tag })).toContainText("Staging");
  await expect(pub.getByTestId("review").filter({ hasText: tag })).not.toContainText("Customer");
  await pub.goto(`/services/${svcRow.slug}`);
  await expect(pub.getByTestId("review").filter({ hasText: tag })).toContainText("Completed service");
});

test("B5. a review cannot be written twice or by someone else (database refuses)", async () => {
  const { order } = (globalThis as Any).__rv;
  const item = (await one(svc.from("order_items").select("id").eq("order_id", order)))[0].id;
  await expect(rpc("customer", "submit_marketplace_review", { p_kind: "product", p_ref: item, p_rating: 5, p_title: null, p_body: "Trying to review a second time." })).rejects.toThrow(/already_reviewed/);
  await expect(rpc("host", "submit_marketplace_review", { p_kind: "product", p_ref: item, p_rating: 5, p_title: null, p_body: "Someone else reviewing it." })).rejects.toThrow(/not_found/);
});

test("C. the admin finance view: nothing is paid, commission is unconfigured or recorded-but-not-applied, no revenue is claimed", async () => {
  await admin.goto("/admin/marketplace-finance");
  await expect(admin.getByTestId("not-unpaid")).toHaveText("0");
  // Owner decision 24 Nov 2026: a 20% rate is recorded on staging, but nothing is paid so nothing is applied. Either wording is acceptable; a claim of earned commission never is.
  await expect(admin.getByText(/UNCONFIGURED|not applied: nothing is paid/).first()).toBeVisible();
  await expect(admin.getByText(/not available/i).first()).toBeVisible();
  await expect(admin.getByText(/Unpaid: payment not configured/i).first()).toBeVisible();
  await noSideScroll(admin, "the finance page");
  expect((await svc.from("orders").select("id").neq("payment_status", "unpaid")).data).toHaveLength(0);
  expect((await svc.from("service_requests").select("id").neq("payment_status", "unpaid")).data).toHaveLength(0);
});

