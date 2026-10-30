import { expect, test } from "@playwright/test";

const NAMES = ["Green Valley Farm Stay", "Countryside Garden Cottage", "Forest Edge Eco Retreat", "Riverside Nature Escape", "Organic Farm Experience", "Weekend Cycling Retreat"];
const NOTICE = "This is a demonstration property. Prices, images and availability are illustrative and do not represent a verified real-world property.";
const iso = (d: Date) => d.toISOString().slice(0, 10);
function nextWeekday(weekday: number, minDays = 20): Date {
  const d = new Date(Date.now() + minDays * 86400000);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

test.describe("demo mode on production", () => {
  test("six labelled demo listings, banner on every page, images load", async ({ page }) => {
    await page.goto("/demo/stays");
    await expect(page.getByTestId("demo-mode-banner")).toBeVisible();
    const cards = page.getByTestId("stay-card");
    await expect(cards).toHaveCount(6);
    for (const name of NAMES) await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    for (let i = 0; i < 6; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      await expect(card.getByText("Demo listing — sample data")).toBeVisible();
      await expect(card.getByRole("link", { name: "View Details", exact: true })).toBeVisible();
      await expect(card.getByRole("link", { name: "Book Now", exact: true })).toBeVisible();
      const img = card.locator("img").first();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test("each detail page shows the banner, the exact demonstration notice and a booking panel", async ({ page }) => {
    await page.goto("/demo/stays");
    const hrefs = await page.getByTestId("stay-card").getByRole("link", { name: "View Details", exact: true }).evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    expect(hrefs).toHaveLength(6);
    for (const href of hrefs) {
      const res = await page.goto(href);
      expect(res?.status(), href).toBe(200);
      await expect(page.getByTestId("demo-mode-banner"), href).toBeVisible();
      await expect(page.getByTestId("demo-notice"), href).toContainText(NOTICE);
      await expect(page.locator("#booking"), href).toBeVisible();
      expect(NAMES).toContain((await page.getByRole("heading", { level: 1 }).innerText()).trim());
    }
  });

  test("filters and search narrow the demo results", async ({ page }) => {
    await page.goto("/demo/stays?q=nandi");
    await expect(page.getByTestId("stay-card")).toHaveCount(1);
    await page.goto("/demo/stays?category=cottage");
    await expect(page.getByTestId("stay-card")).toHaveCount(1);
    await page.goto("/demo/stays?min=5000&max=7000");
    await expect(page.getByTestId("stay-card")).toHaveCount(2);
  });

  test("date and guest selection, nights, correct totals, and validation messages", async ({ page }) => {
    const monday = nextWeekday(1);
    await page.goto("/demo/stays/demo-countryside-garden-cottage"); // 5,200 weekday / 6,200 weekend, sleeps 3
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await expect(page.getByTestId("booking-quote")).toContainText("2 nights · 2 guests");
    await expect(page.getByTestId("booking-total")).toHaveText("₹10,400");
    const friday = nextWeekday(5);
    await page.locator("#check_in").fill(iso(friday));
    await page.locator("#check_out").fill(iso(plus(friday, 2)));
    await expect(page.getByTestId("booking-total")).toHaveText("₹12,400");
    await page.locator("#adults").fill("3");
    await page.locator("#children").fill("1");
    await expect(page.getByTestId("booking-problem")).toContainText("sleeps up to 3 guests");
    await page.locator("#children").fill("0");
    await page.locator("#check_out").fill(iso(friday));
    await expect(page.getByTestId("booking-problem")).toContainText("Check-out must be after check-in");
  });

  test("the demo 'booking' never saves anything and never claims success", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => { if (r.method() !== "GET") requests.push(`${r.method()} ${r.url()}`); });
    const monday = nextWeekday(1);
    await page.goto("/demo/stays/demo-countryside-garden-cottage");
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await page.getByRole("button", { name: "Request to book (demo)" }).click();
    await expect(page.getByTestId("demo-booking-note")).toContainText("nothing was saved");
    await expect(page.locator("main")).not.toContainText(/booking (confirmed|successful)|request sent/i);
    expect(requests, "demo mode must not send any write request").toEqual([]);
  });
});

test.describe("live marketplace boundaries", () => {
  test("Explore Stays tells the truth when the database is unavailable and never invents listings", async ({ page }) => {
    await page.goto("/stays");
    const text = await page.locator("main").innerText();
    if (/couldn.t load stays|hasn.t been connected/i.test(text)) {
      await expect(page.getByTestId("stay-card")).toHaveCount(0);
      await expect(page.getByRole("link", { name: /demo/i }).first()).toBeVisible();
    } else {
      // Database installed: every sample listing must be badged as demo data.
      for (const card of await page.getByTestId("stay-card").all()) {
        if (/Green Valley|Garden Cottage|Forest Edge|Riverside|Organic Farm|Cycling Retreat/.test(await card.innerText())) await expect(card.getByText("Demo listing — sample data")).toBeVisible();
      }
    }
  });

  test("a booking selection is carried through sign-in and sign-up", async ({ page }) => {
    const next = "/stays/demo-green-valley-farm-stay?checkin=2026-12-07&checkout=2026-12-10&guests=3#booking";
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(`${path}?next=${encodeURIComponent(next)}`);
      const values = await page.locator('input[name="next"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
      expect(values.length, path).toBeGreaterThanOrEqual(2);
      for (const v of values) expect(v).toBe(next);
    }
    await page.goto(`/sign-in?next=${encodeURIComponent("https://evil.example/x")}`);
    expect(await page.locator('input[name="next"]').count()).toBe(0);
  });

  test("customer, host and admin areas redirect signed-out visitors to sign-in", async ({ page }) => {
    for (const path of ["/dashboard/bookings", "/host/bookings", "/host/properties/new", "/admin", "/admin/properties/pending"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/sign-in\?next=/);
    }
  });

  test("security headers, robots and sitemap", async ({ request }) => {
    const res = await request.get("/demo/stays");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["strict-transport-security"]).toBeTruthy();
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /demo");
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/demo");
  });
});
