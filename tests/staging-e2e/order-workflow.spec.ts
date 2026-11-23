import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// STAGING ONLY. Drives the real app (built with staging credentials) as the synthetic @staging.test users and checks actual database state.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let fx: Any;
let stayBaseline: (number | null)[] = [];
let svc: Any;
const ctxs: BrowserContext[] = [];

async function newPage(browser: Browser): Promise<Page> {
  const u = test.info().project.use as Any;
  const ctx = await browser.newContext({ viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, baseURL: u.baseURL });
  ctxs.push(ctx);
  return ctx.newPage();
}

async function signIn(page: Page, email: string, next = "/dashboard") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(fx.password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const one = async (q: Any) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };

const stayCounts = async () => [(await svc.from("payments").select("id", { count: "exact", head: true })).count, (await svc.from("bookings").select("id", { count: "exact", head: true })).count, (await svc.from("commission_ledger").select("id", { count: "exact", head: true })).count];

test.describe.configure({ mode: "serial" });

let customer: Page, sellerA: Page, sellerB: Page, sellerC: Page, admin: Page;
let reference = "";
const orders: Record<string, string> = {};
const stock = async (variantId: string) => (await one(svc.from("product_variants").select("stock_on_hand").eq("id", variantId).single())).stock_on_hand as number;
const P = () => fx.products as Record<string, { id: string; slug: string; name: string; vendorId: string; variants: { id: string; name: string; price: number }[] }>;

test.beforeAll(async ({ browser }) => {
  const { seedFixtures } = await import("../staging/seed-ui.mjs");
  const { loadEnv, clients } = await import("../staging/lib.mjs");
  fx = await seedFixtures(test.info().project.name);
  stayBaseline = await stayCounts();
  svc = clients(loadEnv()).service;
  customer = await newPage(browser); sellerA = await newPage(browser); sellerB = await newPage(browser); sellerC = await newPage(browser); admin = await newPage(browser);
});
test.afterAll(async () => { for (const c of ctxs) await c.close(); });

test("1. the customer adds products from three sellers, with variants, to one cart", async () => {
  await signIn(customer, "customer@staging.test", "/shop");
  // Seller A: choose the Medium pot, quantity 2
  await customer.goto(`/shop/p/${P().A.slug}`);
  await expect(customer.getByTestId("product-price")).toHaveText(money(500));
  await customer.getByText("Medium pot", { exact: true }).click();
  await expect(customer.getByTestId("product-price")).toHaveText(money(700));
  await customer.getByRole("button", { name: "Increase quantity" }).click();
  await customer.getByRole("button", { name: "Add to cart" }).click();
  await expect(customer.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
  await expect(customer.getByText(/unpaid requests/i)).toBeVisible();
  // Seller B x1, Seller C x3
  await customer.goto(`/shop/p/${P().B.slug}`);
  await customer.getByRole("button", { name: "Add to cart" }).click();
  await expect(customer.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
  await customer.goto(`/shop/p/${P().C.slug}`);
  await customer.getByRole("button", { name: "Increase quantity" }).click();
  await customer.getByRole("button", { name: "Increase quantity" }).click();
  await customer.getByRole("button", { name: "Add to cart" }).click();
  await expect(customer.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
  // database truth
  const rows = await one(svc.from("cart_items").select("variant_id, quantity").eq("user_id", fx.customerId));
  expect(rows).toHaveLength(3);
  expect(rows.find((r: Any) => r.variant_id === P().A.variants[1].id).quantity).toBe(2);
});

test("2. the cart is grouped by seller, totals are live, quantities change, items can be removed and re-added", async () => {
  await customer.goto("/cart?pin=560078");
  await expect(customer.getByTestId("cart-vendor")).toHaveCount(3);
  await expect(customer.getByText("Delivers to 560078")).toHaveCount(3);
  await expect(customer.getByTestId("cart-total")).toHaveText(money(2650)); // 2x700 + 1x500 + 3x250
  await expect(customer.getByText("Not configured yet").first()).toBeVisible(); // delivery charges are not invented
  const c = customer.getByTestId("cart-line").filter({ hasText: "UI Hand trowel" });
  await c.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(customer.getByTestId("cart-total")).toHaveText(money(2400));
  await c.getByRole("button", { name: "Increase quantity" }).click();
  await expect(customer.getByTestId("cart-total")).toHaveText(money(2650));
  await customer.getByTestId("cart-line").filter({ hasText: "UI Neem compost" }).getByRole("button", { name: /Remove/ }).click();
  await expect(customer.getByTestId("cart-vendor")).toHaveCount(2);
  await expect(customer.getByTestId("cart-total")).toHaveText(money(2150));
  await customer.goto(`/shop/p/${P().B.slug}`);
  await customer.getByRole("button", { name: "Add to cart" }).click();
  await expect(customer.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
  await customer.goto("/cart?pin=560078");
  await expect(customer.getByTestId("cart-vendor")).toHaveCount(3);
  await expect(customer.getByTestId("cart-total")).toHaveText(money(2650));
});

test("3. a PIN that a seller does not serve blocks checkout clearly", async () => {
  await customer.goto("/cart?pin=110001");
  await expect(customer.getByText("Does not deliver to 110001")).toHaveCount(3);
  await expect(customer.getByText(/Fix the items marked above|add a delivery address/i)).toBeVisible();
});

test("4. checkout: add an address, acknowledge the unpaid request and submit; the order is split into three", async () => {
  await customer.goto("/checkout");
  await expect(customer.getByTestId("checkout-vendor")).toHaveCount(3);
  await expect(customer.getByTestId("payment-status").first().or(customer.getByText("UNPAID: PAYMENT NOT CONFIGURED").first())).toBeVisible();
  await customer.locator("#an-new").fill("Staging Customer");
  await customer.locator("#ap-new").fill("+91 98000 00001");
  await customer.locator("#a1-new").fill("12 Garden Road");
  await customer.locator("#ac-new").fill("Bengaluru");
  await customer.locator("#as-new").fill("Karnataka");
  await customer.locator("#az-new").fill("560078");
  await customer.getByRole("button", { name: "Save address" }).click();
  await expect(customer.getByText("Staging Customer, +919800000001")).toBeVisible();
  const submit = customer.getByRole("button", { name: "Submit order request" });
  await submit.click();
  await expect(customer.getByText(/confirm that you understand/i)).toBeVisible(); // cannot submit without acknowledging
  await customer.getByLabel(/I understand this is an unpaid order request/i).check();
  await submit.click();
  await customer.waitForURL(/\/checkout\/confirmation\//, { timeout: 60_000 });
  await expect(customer.getByRole("heading", { name: "Order request sent" })).toBeVisible();
  reference = (await customer.getByTestId("checkout-reference").innerText()).trim();
  expect(reference).toMatch(/^HN-C-\d+$/);
  await expect(customer.getByText("UNPAID: PAYMENT NOT CONFIGURED").first()).toBeVisible();
  await expect(customer.getByTestId("confirmation-order")).toHaveCount(3);
  await expect(customer.locator("body")).not.toContainText(/payment (received|successful|confirmed)|transaction id|paid successfully/i);
});

test("5. the database holds exactly what the UI showed: three vendor orders, one checkout, stock deducted, nothing paid", async () => {
  const co = await one(svc.from("checkouts").select("id, items_total_inr, order_count, payment_status").eq("reference", reference).single());
  expect([Number(co.items_total_inr), co.order_count, co.payment_status]).toEqual([2650, 3, "unpaid"]);
  const rows = await one(svc.from("orders").select("id, vendor_id, items_total_inr, status, payment_status, shipping_fee_inr, tax_inr").eq("checkout_id", co.id));
  expect(rows.map((r: Any) => Number(r.items_total_inr)).sort((a: number, b: number) => b - a)).toEqual([1400, 750, 500]);
  expect(rows.every((r: Any) => r.status === "placed" && r.payment_status === "unpaid" && r.shipping_fee_inr === null && r.tax_inr === null)).toBe(true);
  for (const k of ["A", "B", "C"]) orders[k] = rows.find((r: Any) => r.vendor_id === P()[k].vendorId).id;
  expect([await stock(P().A.variants[1].id), await stock(P().A.variants[0].id), await stock(P().B.variants[0].id), await stock(P().C.variants[0].id)]).toEqual([28, 30, 29, 27]);
  expect((await one(svc.from("cart_items").select("*").eq("user_id", fx.customerId))).length).toBe(0);
  expect((await svc.from("payments").select("id", { count: "exact", head: true })).count).toBe(0);
});

test("6. the customer sees all three orders, each with its seller, and cannot be confused with unpaid vs paid", async () => {
  await customer.goto("/dashboard/orders");
  await expect(customer.getByTestId("order-row").filter({ hasText: reference })).toHaveCount(3);
  await expect(customer.getByTestId("payment-status").first()).toContainText("UNPAID: PAYMENT NOT CONFIGURED");
  await customer.goto(`/dashboard/orders/${orders.A}`);
  await expect(customer.getByText("Request sent: waiting for the seller").first()).toBeVisible();
  await expect(customer.getByText("Other orders in this checkout")).toBeVisible();
  await expect(customer.getByRole("button", { name: "Cancel this order" })).toBeVisible(); // not yet accepted: immediate cancellation is offered
});

test("7. each seller sees only their own order; another seller's order URL is not found", async () => {
  await signIn(sellerA, "seller-a@staging.test", "/vendor/orders");
  await expect(sellerA.getByTestId("vendor-order-row").filter({ hasText: P().A.name })).toHaveCount(1);
  await expect(sellerA.getByText(P().B.name)).toHaveCount(0);
  await expect(sellerA.getByText(P().C.name)).toHaveCount(0);
  await signIn(sellerB, "seller-b@staging.test", "/vendor/orders");
  await expect(sellerB.getByTestId("vendor-order-row").filter({ hasText: P().B.name })).toHaveCount(1);
  await expect(sellerB.getByText(P().A.name)).toHaveCount(0);
  const res = await sellerB.goto(`/vendor/orders/${orders.A}`);
  expect(res?.status()).toBe(404);
});

test("8. seller A accepts (customer address appears only now), packs, ships with tracking and delivers; the customer sees every step", async () => {
  await sellerA.goto(`/vendor/orders/${orders.A}`);
  await expect(sellerA.getByTestId("vendor-customer-address")).toHaveCount(0);
  await expect(sellerA.getByText(/shown after you accept/i)).toBeVisible();
  await sellerA.locator("#respond-decision").selectOption("accept");
  await sellerA.getByRole("button", { name: "Apply decision" }).click();
  await expect(sellerA.getByTestId("vendor-customer-address")).toContainText("12 Garden Road", { timeout: 30_000 });
  await expect(sellerA.getByTestId("vendor-customer-address")).toContainText("+919800000001");
  await sellerA.getByRole("button", { name: "Mark as packed" }).click();
  await expect(sellerA.getByRole("heading", { name: "Dispatch" })).toBeVisible();
  await sellerA.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(sellerA.getByText("Please fix the highlighted fields.")).toBeVisible(); // validation: carrier and tracking required; wait for the reply before typing
  await sellerA.locator("#ship-carrier").fill("DTDC");
  await sellerA.locator("#ship-tracking").fill(`TRK${fx.run.slice(-6).toUpperCase()}`);
  await sellerA.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(sellerA.getByRole("heading", { name: "Shipment" })).toBeVisible({ timeout: 30_000 });
  // customer sees shipped + tracking
  await customer.goto(`/dashboard/orders/${orders.A}`);
  await expect(customer.getByText("Shipped", { exact: true }).first()).toBeVisible();
  await expect(customer.getByTestId("tracking-number")).toHaveText(`TRK${fx.run.slice(-6).toUpperCase()}`);
  // deliver
  await sellerA.goto(`/vendor/orders/${orders.A}`);
  await sellerA.locator('select[name="status"]').selectOption("delivered");
  await sellerA.getByRole("button", { name: "Update", exact: true }).click();
  await expect.poll(async () => (await one(svc.from("orders").select("status").eq("id", orders.A).single())).status, { timeout: 30_000 }).toBe("delivered");
  await customer.reload();
  await expect(customer.getByText("Delivered", { exact: true }).first()).toBeVisible();
  const hist = await one(svc.from("order_status_history").select("to_status").eq("order_id", orders.A).order("id"));
  expect(hist.map((h: Any) => h.to_status)).toEqual(["placed", "confirmed", "packed", "shipped", "delivered"]);
});

test("9. seller B declines with a reason; stock returns and the customer is told", async () => {
  await sellerB.goto(`/vendor/orders/${orders.B}`);
  await sellerB.locator("#respond-decision").selectOption("reject");
  await sellerB.getByRole("button", { name: "Apply decision" }).click();
  await expect(sellerB.getByRole("alert").filter({ hasText: /reason/i })).toBeVisible(); // reason required: wait for the reply before typing
  await sellerB.locator("#respond-reason").fill("Out of stock at the farm today");
  await sellerB.getByRole("button", { name: "Apply decision" }).click();
  await expect.poll(async () => (await one(svc.from("orders").select("status").eq("id", orders.B).single())).status, { timeout: 30_000 }).toBe("rejected");
  expect(await stock(P().B.variants[0].id)).toBe(30);
  await customer.goto(`/dashboard/orders/${orders.B}`);
  await expect(customer.getByText(/Declined by the seller: Out of stock at the farm today/)).toBeVisible();
});

test("10. cancellation request: customer asks after acceptance, seller C approves, order is cancelled and restocked", async () => {
  await signIn(sellerC, "seller-c@staging.test", `/vendor/orders/${orders.C}`);
  await sellerC.locator("#respond-decision").selectOption("accept");
  await sellerC.getByRole("button", { name: "Apply decision" }).click();
  await expect(sellerC.getByTestId("vendor-customer-address")).toBeVisible({ timeout: 30_000 });
  await customer.goto(`/dashboard/orders/${orders.C}`);
  await customer.locator("#cancel-reason").fill("Ordered the wrong tool");
  await customer.getByRole("button", { name: "Request cancellation" }).click();
  await expect.poll(async () => (await svc.from("order_requests").select("id", { count: "exact", head: true }).eq("order_id", orders.C).eq("kind", "cancel")).count, { timeout: 30_000 }).toBe(1);
  await customer.reload();
  await expect(customer.getByText("Your cancellation request is waiting for the seller.")).toBeVisible({ timeout: 30_000 });
  expect((await one(svc.from("orders").select("status").eq("id", orders.C).single())).status).toBe("confirmed");
  await sellerC.reload();
  await expect(sellerC.getByText(/Cancellation request: requested/i)).toBeVisible();
  await sellerC.locator('select[name="decision"]').selectOption("approve");
  await sellerC.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await one(svc.from("orders").select("status").eq("id", orders.C).single())).status, { timeout: 30_000 }).toBe("cancelled");
  expect(await stock(P().C.variants[0].id)).toBe(30);
  await customer.reload();
  await expect(customer.getByText("Cancelled", { exact: true }).first()).toBeVisible();
});

test("11. return request on the delivered order: allowed with no policy (and says so), the seller decides, the customer sees the decision", async () => {
  await customer.goto(`/dashboard/orders/${orders.A}`);
  await expect(customer.getByTestId("policy-summary")).toContainText(/policy|not decided|set/i);
  await customer.locator("#return-reason").fill("One plant arrived damaged");
  await customer.getByRole("button", { name: "Send request" }).click();
  await expect.poll(async () => (await svc.from("order_requests").select("id", { count: "exact", head: true }).eq("order_id", orders.A).eq("kind", "return")).count, { timeout: 30_000 }).toBe(1);
  await customer.reload();
  await expect(customer.getByText(/Return: Requested/i)).toBeVisible({ timeout: 30_000 }); // the request now appears under "Your requests"
  const req = await one(svc.from("order_requests").select("kind, status, policy_note").eq("order_id", orders.A).single());
  expect(req.kind).toBe("return");
  expect(req.status).toBe("requested");
  expect(req.policy_note).toMatch(/No return policy is configured yet/);
  await sellerA.goto(`/vendor/orders/${orders.A}`);
  await expect(sellerA.getByText(/Return request: requested/i)).toBeVisible();
  await sellerA.locator('select[name="decision"]').selectOption("reject");
  await sellerA.locator('input[name="note"]').fill("Damage not covered by our care guide");
  await sellerA.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await one(svc.from("order_requests").select("status").eq("order_id", orders.A).single())).status, { timeout: 30_000 }).toBe("rejected");
  await customer.reload();
  await expect(customer.getByText(/Decision note: Damage not covered by our care guide/)).toBeVisible();
});

test("12. the administrator monitors everything: search by checkout reference, trace, financial breakdown, requests, policies", async () => {
  await signIn(admin, "admin@staging.test", "/admin/orders");
  await admin.locator('input[name="q"]').fill(reference);
  await admin.getByRole("button", { name: "Filter" }).click();
  await expect(admin.getByTestId("admin-order-row")).toHaveCount(3);
  await expect(admin.getByText("UNPAID").first()).toBeVisible();
  await admin.getByRole("link", { name: /HN-O-\d+/ }).first().click();
  await expect(admin.getByTestId("admin-checkout-ref")).toHaveText(reference);
  await expect(admin.getByTestId("admin-payment-status")).toHaveText("UNPAID: PAYMENT NOT CONFIGURED");
  await expect(admin.getByText("Not configured: no rate has been approved for products")).toBeVisible();
  await admin.goto("/admin/orders?view=requests");
  await expect(admin.getByRole("link", { name: /HN-O-\d+/ }).first()).toBeVisible();
  await admin.goto("/admin/orders?view=cancellations");
  await expect(admin.getByTestId("admin-order-row").filter({ hasText: reference })).toHaveCount(2); // declined + cancelled
  // configure a return policy through the UI and see it on the product page
  await admin.goto("/admin/order-policies");
  await expect(admin.getByText("Not configured").first()).toBeVisible();
  const plantsForm = admin.locator("form").filter({ has: admin.locator('select[aria-label="Returns for Plants, seeds and saplings"]') });
  await plantsForm.locator('select[aria-label="Returns for Plants, seeds and saplings"]').selectOption("true");
  await plantsForm.locator('input[aria-label="Return window for Plants, seeds and saplings"]').fill("7");
  await plantsForm.getByRole("button", { name: "Save" }).click();
  await expect(plantsForm.getByText("Policy saved.")).toBeVisible({ timeout: 30_000 });
  const pol = await one(svc.from("product_category_policies").select("returns_allowed, return_window_days").eq("category_id", (await one(svc.from("product_categories").select("id").eq("slug", "plants-seeds-saplings").single())).id).single());
  expect([pol.returns_allowed, pol.return_window_days]).toEqual([true, 7]);
  await customer.goto(`/shop/p/${P().A.slug}`);
  await expect(async () => { await customer.reload(); await expect(customer.getByTestId("return-policy")).toContainText("within 7 days of delivery", { timeout: 5000 }); }).toPass({ timeout: 60_000 }); // the public page may be cached for a few seconds
});

test.afterAll(async () => { await svc?.from("product_category_policies").delete().neq("category_id", 0); }); // never leave a policy behind

test("13. nothing was ever recorded as paid, stock adds up, and the Stay tables are untouched", async () => {
  expect((await svc.from("orders").select("id", { count: "exact", head: true }).neq("payment_status", "unpaid")).count).toBe(0);
  expect((await svc.from("checkouts").select("id", { count: "exact", head: true }).neq("payment_status", "unpaid")).count).toBe(0);
  expect([(await svc.from("payments").select("id", { count: "exact", head: true })).count, (await svc.from("bookings").select("id", { count: "exact", head: true })).count, (await svc.from("commission_ledger").select("id", { count: "exact", head: true })).count]).toEqual(stayBaseline); // the order workflow must not change Stay tables
  const variantIds = Object.values(P()).flatMap((p) => p.variants.map((v) => v.id));
  for (const id of variantIds) {
    const v = await one(svc.from("product_variants").select("stock_on_hand").eq("id", id).single());
    const mv = await one(svc.from("inventory_movements").select("delta").eq("variant_id", id));
    expect(mv.reduce((t: number, m: Any) => t + m.delta, 0)).toBe(v.stock_on_hand);
  }
});
