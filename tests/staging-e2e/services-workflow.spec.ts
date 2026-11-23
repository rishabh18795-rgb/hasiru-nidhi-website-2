import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// STAGING ONLY. Drives the real app (built with staging credentials) through the Services module as synthetic @staging.test users,
// and reads the resulting state straight from the database. Runs on a desktop and a phone-sized browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let svc: Any;
let password = "";
const ctxs: BrowserContext[] = [];
const tag = `${Date.now().toString(36)}`;
let fixedName = "", quoteName = "", fixedSlug = "", quoteSlug = "", fixedId = "", quoteId = "";
let customer: Page, provider: Page, admin: Page;
let reqFixed = "", reqQuote = "";

async function newPage(browser: Browser): Promise<Page> {
  const u = test.info().project.use as Any;
  const ctx = await browser.newContext({ viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, baseURL: u.baseURL });
  ctxs.push(ctx);
  const page = await ctx.newPage();
  page.on("dialog", (d) => void d.accept());
  return page;
}
async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}
const one = async (q: Any) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
async function noSideScroll(page: Page, what: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${what} must not scroll sideways`).toBeLessThanOrEqual(1);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const { loadEnv, clients, signedIn: signedInUser } = await import("../staging/lib.mjs");
  const env = loadEnv();
  const c = clients(env);
  svc = c.service;
  password = env.STAGING_TEST_PASSWORD;
  const project = test.info().project.name;
  fixedName = `E2E Lawn care ${project} ${tag}`;
  quoteName = `E2E Garden design ${project} ${tag}`;
  await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_services_enabled"]);
  const prov = await signedInUser(env, c, "seller-a@staging.test", "Staging Seller A");
  await signedInUser(env, c, "customer@staging.test", "Staging Customer");
  const admn = await signedInUser(env, c, "admin@staging.test", "Staging Admin");
  await svc.from("profiles").update({ role: "admin" }).eq("id", admn.id);
  const vendor = (await one(svc.from("vendors").select("*").eq("owner_id", prov.id).single()));
  const cap = (await svc.from("vendor_capabilities").select("status").eq("vendor_id", vendor.id).eq("capability", "services").maybeSingle()).data;
  if (!cap) await one(prov.client.rpc("request_vendor_capability", { p_capability: "services" }));
  if (cap?.status !== "approved") await one(admn.client.rpc("admin_review_capability", { p_vendor: vendor.id, p_capability: "services", p_decision: "approve", p_reason: null }));
  await one(prov.client.rpc("set_vendor_service_areas", { p_scope: "service", p_codes: ["560"] }));
  await one(prov.client.rpc("set_service_availability", { p_rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })) }));
  const cat = (await one(svc.from("service_categories").select("id").eq("slug", "gardening").single())).id;
  const jpg = (await import("node:fs")).readFileSync((await import("node:path")).join(process.cwd(), "public/images/gardening/marigold-flowers-garden-karnataka.jpg"));
  const make = async (name: string, extra: Record<string, unknown>) => {
    const id = await one(prov.client.rpc("save_service", { p: { category_id: cat, name, summary: "Staging browser test service.", description: "A staging browser test service listing with a description longer than thirty characters.", duration_minutes: 60, ...extra } }));
    const path = `${vendor.id}/${id}/e2e-${tag}.jpg`;
    await one(prov.client.storage.from("service-images").upload(path, jpg, { contentType: "image/jpeg" }));
    await one(prov.client.rpc("register_service_image", { p_service: id, p_path: path, p_alt: "Garden" }));
    await one(prov.client.rpc("submit_service", { p_service: id }));
    await one(admn.client.rpc("admin_review_service", { p_service: id, p_decision: "approve", p_reason: null }));
    return { id, slug: (await one(svc.from("services").select("slug").eq("id", id).single())).slug as string };
  };
  ({ id: fixedId, slug: fixedSlug } = await make(fixedName, { pricing_model: "fixed", price_inr: 500, price_unit: "visit" }));
  ({ id: quoteId, slug: quoteSlug } = await make(quoteName, { pricing_model: "quote" }));
  customer = await newPage(browser); provider = await newPage(browser); admin = await newPage(browser);
});
test.afterAll(async () => {
  for (const id of [fixedId, quoteId]) if (id) await svc.from("services").update({ status: "archived" }).eq("id", id);
  for (const c of ctxs) await c.close();
});

test("1. visitors see the live listings with real prices, and the Services link appears", async ({ page }) => {
  await page.goto(`/services?q=${encodeURIComponent(tag)}`);
  await expect(page.locator("h1")).toContainText("Results for");
  await expect(page.getByTestId("service-card")).toHaveCount(2);
  await expect(page.getByTestId("service-card").filter({ hasText: fixedName }).getByTestId("service-price")).toHaveText("₹500 per visit");
  await expect(page.getByTestId("service-card").filter({ hasText: quoteName }).getByTestId("service-price")).toHaveText("Quotation on request");
  await noSideScroll(page, "the services list");
  await page.goto(`/services?pricing=fixed&pin=110001`);
  await expect(page.getByText(/no services match/i)).toBeVisible();
  await page.goto(`/services/${fixedSlug}`);
  await expect(page.getByRole("heading", { name: fixedName })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in to continue/i })).toBeVisible();
  await noSideScroll(page, "the service page");
});

test("2. a customer requests the fixed-price service with a real time slot; it is sent unpaid", async () => {
  await signIn(customer, "customer@staging.test", `/services/${fixedSlug}`);
  await customer.goto(`/services/${fixedSlug}`);
  await customer.getByLabel("Phone").fill("9876500000");
  await customer.getByLabel(/Where is the work needed/).fill("12 Rose Street");
  await customer.getByLabel("City or town").fill("Bengaluru");
  await customer.getByLabel("PIN code").fill("560078");
  await customer.getByRole("button", { name: "Check area" }).click();
  await expect(customer.getByTestId("coverage-result")).toContainText(/serves your PIN/i);
  await customer.getByLabel("How many visits?").fill("2");
  await expect(customer.getByTestId("request-total")).toHaveText("₹1,000");
  await customer.getByLabel("Preferred time").selectOption({ index: 2 });
  await noSideScroll(customer, "the request form");
  await customer.getByRole("button", { name: "Send request" }).click();
  await customer.waitForURL(/\/dashboard\/requests\/[0-9a-f-]{36}/, { timeout: 30_000 });
  reqFixed = customer.url().match(/requests\/([0-9a-f-]{36})/)![1];
  await expect(customer.getByTestId("payment-status").first()).toHaveText("UNPAID: PAYMENT NOT CONFIGURED");
  await expect(customer.getByText(/Request sent: waiting for the provider/).first()).toBeVisible();
  const row = await one(svc.from("service_requests").select("status, payment_status, agreed_total_inr, preferred_start").eq("id", reqFixed).single());
  expect([row.status, row.payment_status, Number(row.agreed_total_inr)]).toEqual(["submitted", "unpaid", 1000]);
  expect(row.preferred_start).not.toBeNull();
});

test("3. the provider sees the area but not the phone, accepts, and the customer's details appear", async () => {
  await signIn(provider, "seller-a@staging.test", `/vendor/service-requests/${reqFixed}`);
  await provider.goto(`/vendor/service-requests/${reqFixed}`);
  await expect(provider.getByText("Shown once you accept the request")).toBeVisible();
  await expect(provider.getByText("9876500000")).toHaveCount(0);
  await provider.getByRole("button", { name: "Apply decision" }).click();
  await expect(provider.getByText("9876500000")).toBeVisible({ timeout: 20_000 });
  await expect(provider.getByTestId("appointment")).toBeVisible();
  await noSideScroll(provider, "the provider request page");
  await provider.getByRole("button", { name: "Mark as started" }).click();
  await expect(provider.getByText("Work in progress").first()).toBeVisible({ timeout: 20_000 });
  await provider.getByRole("button", { name: "Mark as completed" }).click();
  await expect.poll(async () => (await one(svc.from("service_requests").select("status").eq("id", reqFixed).single())).status, { timeout: 20_000 }).toBe("completed");
  expect((await one(svc.from("service_requests").select("payment_status").eq("id", reqFixed).single())).payment_status).toBe("unpaid");
});

test("4. the customer sees the finished service, still unpaid, with the full history", async () => {
  await customer.goto(`/dashboard/requests/${reqFixed}`);
  await expect(customer.getByText("Completed").first()).toBeVisible();
  await expect(customer.getByTestId("payment-status").first()).toHaveText("UNPAID: PAYMENT NOT CONFIGURED");
  await customer.goto("/dashboard/requests");
  await expect(customer.getByTestId("request-row").filter({ hasText: fixedName })).toBeVisible();
  await noSideScroll(customer, "the request list");
});

test("5. quotation flow: ask, quote, accept; the agreed amount is the quote", async () => {
  await customer.goto(`/services/${quoteSlug}`);
  await customer.getByLabel("Phone").fill("9876500000");
  await customer.getByLabel(/Where is the work needed/).fill("12 Rose Street");
  await customer.getByLabel("City or town").fill("Bengaluru");
  await customer.getByLabel("PIN code").fill("560078");
  await customer.getByLabel("Describe the work you need").fill("Redesign a small terrace garden with low-water plants.");
  await customer.getByRole("button", { name: "Request a quotation" }).click();
  await customer.waitForURL(/\/dashboard\/requests\/[0-9a-f-]{36}/, { timeout: 30_000 });
  reqQuote = customer.url().match(/requests\/([0-9a-f-]{36})/)![1];

  await provider.goto(`/vendor/service-requests/${reqQuote}`);
  await expect(provider.getByRole("heading", { name: "Send a quotation" })).toBeVisible();
  await provider.getByLabel("Quoted amount (₹)").fill("9500");
  await provider.getByLabel("What the quotation covers").fill("Design, plants and one site visit.");
  await provider.getByRole("button", { name: "Send quotation" }).click();
  await expect.poll(async () => (await one(svc.from("service_requests").select("status").eq("id", reqQuote).single())).status, { timeout: 20_000 }).toBe("quoted");

  await customer.goto(`/dashboard/requests/${reqQuote}`);
  await expect(customer.getByTestId("quotation-amount")).toHaveText("₹9,500");
  await customer.getByRole("button", { name: "Send my decision" }).click();
  await expect.poll(async () => (await one(svc.from("service_requests").select("status, agreed_total_inr").eq("id", reqQuote).single())).status, { timeout: 20_000 }).toBe("accepted");
  expect(Number((await one(svc.from("service_requests").select("agreed_total_inr").eq("id", reqQuote).single())).agreed_total_inr)).toBe(9500);
  await noSideScroll(customer, "the quotation page");
});

test("6. the administrator sees the overview, the review queue and unconfigured commission", async () => {
  await signIn(admin, "admin@staging.test", "/admin/marketplace");
  await admin.goto("/admin/marketplace");
  await expect(admin.getByText("At a glance")).toBeVisible();
  await expect(admin.getByText("Live services")).toBeVisible();
  await noSideScroll(admin, "the marketplace overview");
  await admin.goto("/admin/marketplace-commission");
  await expect(admin.getByText("UNCONFIGURED").first()).toBeVisible();
  await noSideScroll(admin, "the commission page");
  await admin.goto("/admin/services?status=approved");
  await expect(admin.getByRole("link", { name: fixedName })).toBeVisible();
  await admin.goto(`/admin/service-requests/${reqQuote}`);
  await expect(admin.getByRole("button", { name: "Cancel this request" })).toBeVisible();
  await admin.getByLabel(/Reason \(required/).fill("Browser test cleanup");
  await admin.getByRole("button", { name: "Cancel this request" }).click();
  await expect.poll(async () => (await one(svc.from("service_requests").select("status").eq("id", reqQuote).single())).status, { timeout: 20_000 }).toBe("cancelled");
});

test("7. provider screens fit a phone: services, requests and availability", async () => {
  for (const p of ["/vendor/services", `/vendor/services/${fixedId}`, "/vendor/service-requests?status=all", "/vendor/availability"]) {
    await provider.goto(p);
    await expect(provider.locator("h1").first()).toBeVisible();
    await noSideScroll(provider, p);
  }
  await provider.goto("/gardening");
  await expect(provider.getByRole("heading", { name: /gardening/i }).first()).toBeVisible();
  await expect(provider.getByText("Browse gardening services")).toBeVisible();
});
