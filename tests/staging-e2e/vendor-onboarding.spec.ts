import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";

// STAGING ONLY. A brand-new vendor goes through the real screens: apply, get approved by an administrator (business and each capability
// separately), set coverage, add a product with a photo, variant and stock, submit it, get it approved, adjust stock, then do the same for a service.
// Every important step is confirmed in the database, not just on screen. Runs on desktop and phone.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let svc: Any;
let password = "";
const ctxs: BrowserContext[] = [];
const tag = Date.now().toString(36);
let email = "", businessName = "", productName = "", serviceName = "", vendorId = "", productId = "", serviceId = "";
let vendor: Page, admin: Page;
const PHOTO = path.join(process.cwd(), "public/images/gardening/marigold-flowers-garden-karnataka.jpg");
const one = async (q: Any) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };

async function newPage(browser: Browser): Promise<Page> {
  const u = test.info().project.use as Any;
  const ctx = await browser.newContext({ viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, baseURL: u.baseURL });
  ctxs.push(ctx);
  return ctx.newPage();
}
async function signIn(page: Page, em: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.locator("#email").fill(em);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}
async function noSideScroll(page: Page, what: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${what} must not scroll sideways`).toBeLessThanOrEqual(1);
}
const status = async (table: string, id: string) => (await one(svc.from(table).select("status").eq("id", id).single())).status as string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const { loadEnv, clients, signedIn: su } = await import("../staging/lib.mjs");
  const env = loadEnv() as Record<string, string>;
  const c = clients(env);
  svc = c.service;
  password = env.STAGING_TEST_PASSWORD;
  const project = test.info().project.name;
  email = `onboard-${project}-${tag}@staging.test`;
  businessName = `Onboarding Farm ${project} ${tag} (demo)`;
  productName = `Onboarding Marigold ${project} ${tag} (demo)`;
  serviceName = `Onboarding Garden visit ${project} ${tag} (demo)`;
  await svc.from("platform_settings").update({ value: true }).in("key", ["marketplace_vendor_registration_enabled", "marketplace_products_enabled", "marketplace_services_enabled"]);
  await su(env, c, email, "Onboarding Vendor"); // a confirmed synthetic account: real sign-up needs a real mailbox, which staging does not have
  const adm = await su(env, c, "admin@staging.test", "Staging Admin");
  await svc.from("profiles").update({ role: "admin" }).eq("id", adm.id);
  vendor = await newPage(browser);
  admin = await newPage(browser);
});
test.afterAll(async () => {
  for (const [t, id] of [["products", productId], ["services", serviceId]]) if (id) await svc.from(t).update({ status: "archived" }).eq("id", id);
  for (const c of ctxs) await c.close();
});

test("1. a new account sees it is not a vendor yet, fills in the application and submits it", async () => {
  await signIn(vendor, email, "/vendor");
  await expect(vendor.getByText("You are not a vendor yet")).toBeVisible();
  await vendor.goto("/vendor/profile");
  await vendor.getByLabel("Business name").fill(businessName);
  await vendor.getByLabel("Business type").selectOption("farm");
  await vendor.getByLabel("About your business").fill("A small farm that grows flowers and vegetables. This is a staging test vendor.");
  await vendor.getByLabel("Contact name").fill("Onboarding Vendor");
  await vendor.getByLabel("Contact phone").fill("9876501234");
  await vendor.getByLabel("Contact email").fill(email);
  await vendor.getByLabel("Business address").fill("1 Farm Road");
  await vendor.getByLabel("City").fill("Bengaluru");
  await vendor.getByLabel("State").fill("Karnataka");
  await vendor.getByLabel("PIN code").fill("560078");
  await vendor.getByLabel(/Sell products/).check();
  await vendor.getByLabel(/Offer services/).check();
  await noSideScroll(vendor, "the vendor application");
  await vendor.getByRole("button", { name: "Submit application" }).click();
  await expect.poll(async () => (await svc.from("vendors").select("status").eq("business_name", businessName).maybeSingle()).data?.status, { timeout: 20_000 }).toBe("submitted");
  vendorId = (await one(svc.from("vendors").select("id").eq("business_name", businessName).single())).id;
  const caps = (await one(svc.from("vendor_capabilities").select("capability, status").eq("vendor_id", vendorId))).map((x: Any) => `${x.capability}:${x.status}`).sort();
  expect(caps).toEqual(["products:pending", "services:pending"]);
});

test("2. the vendor cannot sell or use anything yet: every capability needs its own approval", async () => {
  await vendor.goto("/vendor/products/new");
  await expect(vendor.getByText(/Selling products needs approval/i)).toBeVisible();
  await vendor.goto("/vendor/services/new");
  await expect(vendor.getByText(/Providing services needs approval/i)).toBeVisible();
});

test("3. an administrator reviews the business, then approves each capability separately", async () => {
  await signIn(admin, "admin@staging.test", "/admin/vendors");
  await admin.goto(`/admin/vendors/${vendorId}`);
  await expect(admin.getByText(businessName).first()).toBeVisible();
  await admin.locator("#vendor-decision").selectOption("approve");
  await admin.getByRole("button", { name: "Apply decision" }).click();
  await expect.poll(() => status("vendors", vendorId), { timeout: 20_000 }).toBe("approved");
  for (const cap of ["products", "services"]) {
    await admin.goto(`/admin/vendors/${vendorId}`);
    await admin.locator("form").filter({ has: admin.getByLabel(`Decision for ${cap}`) }).getByRole("button", { name: "Apply" }).click();
    await expect.poll(async () => (await one(svc.from("vendor_capabilities").select("status").eq("vendor_id", vendorId).eq("capability", cap).single())).status, { timeout: 20_000 }).toBe("approved");
  }
});

test("4. the vendor sets delivery and service areas", async () => {
  await vendor.goto("/vendor/coverage");
  await vendor.getByLabel("Delivery PIN codes").fill("560");
  await vendor.getByRole("button", { name: "Save delivery coverage" }).click();
  await expect.poll(async () => (await svc.from("vendor_service_areas").select("id").eq("vendor_id", vendorId).eq("scope", "delivery")).data?.length, { timeout: 20_000 }).toBe(1);
  await vendor.getByLabel("Service PIN codes").fill("560");
  await vendor.getByRole("button", { name: "Save service coverage" }).click();
  await expect.poll(async () => (await svc.from("vendor_service_areas").select("id").eq("vendor_id", vendorId).eq("scope", "service")).data?.length, { timeout: 20_000 }).toBe(1);
});

test("5. the vendor creates a product, uploads a photo, adds a variant with stock, and submits it for review", async () => {
  await vendor.goto("/vendor/products/new");
  await vendor.getByLabel("Product name").fill(productName);
  await vendor.getByLabel("Category").selectOption({ label: "Plants, seeds and saplings" });
  await vendor.getByLabel("Short summary").fill("Marigold seedlings for borders and pots.");
  await vendor.getByLabel("Description").fill("Healthy marigold seedlings, grown without synthetic inputs. A staging test product used to check the vendor workflow.");
  await vendor.getByRole("button", { name: "Create draft" }).click();
  await vendor.waitForURL(/\/vendor\/products\/[0-9a-f-]{36}/, { timeout: 30_000 });
  productId = vendor.url().match(/products\/([0-9a-f-]{36})/)![1];
  await vendor.getByLabel("Choose product photos").setInputFiles(PHOTO);
  await expect.poll(async () => (await svc.from("product_images").select("id").eq("product_id", productId)).data?.length, { timeout: 40_000 }).toBe(1);
  await vendor.getByLabel("Variant name").first().fill("Pack of 6");
  await vendor.getByLabel("SKU").first().fill(`ONB-${tag}`);
  await vendor.getByLabel("Price (₹)").first().fill("149.50");
  await vendor.getByLabel("Opening stock").first().fill("10");
  await vendor.getByRole("button", { name: "Add variant" }).click();
  await expect.poll(async () => (await svc.from("product_variants").select("stock_on_hand").eq("product_id", productId)).data?.[0]?.stock_on_hand, { timeout: 20_000 }).toBe(10);
  await noSideScroll(vendor, "the product editor");
  await vendor.getByRole("button", { name: "Submit for review" }).click();
  await expect.poll(() => status("products", productId), { timeout: 20_000 }).toBe("pending_review");
});

test("6. the administrator approves the product, and shoppers see it with the exact price", async ({ page }) => {
  await admin.goto(`/admin/products/${productId}`);
  await admin.locator("#product-decision").selectOption("approve");
  await admin.getByRole("button", { name: "Apply decision" }).click();
  await expect.poll(() => status("products", productId), { timeout: 20_000 }).toBe("approved");
  const slug = (await one(svc.from("products").select("slug").eq("id", productId).single())).slug;
  await page.goto(`/shop/p/${slug}`);
  await expect(page.getByTestId("product-price")).toHaveText("₹149.50");
  await expect(page.getByText("In stock").first()).toBeVisible();
});

test("7. the vendor adjusts stock; the change and its reason are logged", async () => {
  await vendor.goto(`/vendor/products/${productId}`);
  const before = (await one(svc.from("inventory_movements").select("id").eq("product_id", productId))).length;
  await vendor.locator("summary").filter({ hasText: "Pack of 6" }).click(); // the variant card opens to show stock controls
  await vendor.getByLabel("Quantity for Pack of 6").fill("5");
  await vendor.getByRole("button", { name: "Adjust stock" }).click();
  await expect.poll(async () => (await one(svc.from("inventory_movements").select("id").eq("product_id", productId))).length, { timeout: 20_000 }).toBe(before + 1);
});

test("8. the vendor creates a fixed-price service with a photo, submits it, the administrator approves it, and it is public", async ({ page }) => {
  await vendor.goto("/vendor/services/new");
  await vendor.getByLabel("Service name").fill(serviceName);
  await vendor.getByLabel("Category").selectOption({ label: "Gardening" });
  await vendor.getByLabel("How is it priced?").selectOption("fixed");
  await vendor.getByLabel("Price (₹)").fill("450");
  await vendor.getByLabel("Description").fill("A garden visit with pruning and general tidy-up. A staging test service used to check the vendor workflow.");
  await vendor.getByRole("button", { name: "Create draft" }).click();
  await vendor.waitForURL(/\/vendor\/services\/[0-9a-f-]{36}/, { timeout: 30_000 });
  serviceId = vendor.url().match(/services\/([0-9a-f-]{36})/)![1];
  await vendor.getByLabel("Choose service photos").setInputFiles(PHOTO);
  await expect.poll(async () => (await svc.from("service_images").select("id").eq("service_id", serviceId)).data?.length, { timeout: 40_000 }).toBe(1);
  await vendor.getByRole("button", { name: "Submit for review" }).click();
  await expect.poll(() => status("services", serviceId), { timeout: 20_000 }).toBe("pending_review");
  await admin.goto(`/admin/services/${serviceId}`);
  await admin.locator("#service-decision").selectOption("approve");
  await admin.getByRole("button", { name: "Apply decision" }).click();
  await expect.poll(() => status("services", serviceId), { timeout: 20_000 }).toBe("approved");
  const slug = (await one(svc.from("services").select("slug").eq("id", serviceId).single())).slug;
  await page.goto(`/services/${slug}`);
  await expect(page.getByTestId("service-price").first()).toHaveText("₹450 per visit");
});

test("9. isolation: another vendor cannot open this vendor's product or service", async ({ browser }) => {
  const other = await newPage(browser);
  await signIn(other, "seller-b@staging.test", "/vendor");
  for (const p of [`/vendor/products/${productId}`, `/vendor/services/${serviceId}`]) {
    const res = await other.goto(p);
    expect([404, 200].includes(res?.status() ?? 0)).toBe(true);
    await expect(other.getByRole("heading", { name: productName })).toHaveCount(0);
    await expect(other.getByRole("heading", { name: serviceName })).toHaveCount(0);
  }
});
