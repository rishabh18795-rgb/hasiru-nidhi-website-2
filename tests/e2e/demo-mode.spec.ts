import { expect, test, type Page } from "@playwright/test";

import { FORMS_PORT } from "../../playwright.config";
import { visit } from "./helpers";

const NAMES = ["Green Valley Farm Stay", "Countryside Garden Cottage", "Forest Edge Eco Retreat", "Riverside Nature Escape", "Organic Farm Experience", "Weekend Cycling Retreat"];
const NOTICE = "This is a demonstration property. Prices, images and availability are illustrative and do not represent a verified real-world property.";
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The next given weekday (0 = Sunday) at least `minDays` days from now, as a Date at UTC midnight. */
function nextWeekday(weekday: number, minDays = 20): Date {
  const d = new Date(Date.now() + minDays * 86400000);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

const cards = (page: Page) => page.getByTestId("stay-card");

test.describe("demo mode: Explore Stays", () => {
  test("is plainly labelled demo mode, with six cards named as requested", async ({ page }) => {
    await visit(page, "/demo/stays");
    await expect(page.getByTestId("demo-mode-banner")).toContainText("Demo mode");
    await expect(page.getByTestId("demo-mode-banner")).toContainText("Not connected to the database");
    await expect(cards(page)).toHaveCount(6);
    for (const name of NAMES) await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("every card shows the DEMO badge, type, location, price, capacity, amenities, and View Details + Book Now", async ({ page }) => {
    await visit(page, "/demo/stays");
    for (let i = 0; i < 6; i++) {
      const card = cards(page).nth(i);
      await expect(card.getByText("Demo listing — sample data")).toBeVisible();
      await expect(card.getByText(/Illustrative demo price/)).toBeVisible();
      await expect(card.getByText(/₹[\d,]+/).first()).toBeVisible();
      await expect(card.getByText(/Up to \d+ guests/)).toBeVisible();
      await expect(card.getByText(/\d+ bedrooms?/)).toBeVisible();
      await expect(card.getByText(/\d+(\.\d)? bathrooms?/)).toBeVisible();
      await expect(card.getByRole("list", { name: "Amenities" }).getByRole("listitem").first()).toBeVisible();
      await expect(card.getByRole("link", { name: "View Details", exact: true })).toHaveAttribute("href", /^\/demo\/stays\/demo-/);
      await expect(card.getByRole("link", { name: "Book Now", exact: true })).toHaveAttribute("href", /^\/demo\/stays\/demo-.*#booking$/);
      const img = card.locator("img").first();
      await img.scrollIntoViewIfNeeded(); // images below the fold are lazy-loaded
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 10_000, message: `image ${i} should load` }).toBe(true);
    }
  });

  test("search and filters work: location, property type, guests, price range", async ({ page }) => {
    await visit(page, "/demo/stays?q=nandi");
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByTestId("demo-result-count")).toHaveText(/1 demo stay/);
    await visit(page, "/demo/stays?category=cottage");
    await expect(cards(page)).toHaveCount(1);
    await visit(page, "/demo/stays?guests=9");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Weekend Cycling Retreat");
    await visit(page, "/demo/stays?min=5000&max=7000");
    await expect(cards(page)).toHaveCount(2);
    await visit(page, "/demo/stays?q=zzzz-nothing");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText("No demo stays match those filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear all filters" }).click();
    await expect(cards(page)).toHaveCount(6);
  });

  test("the filter form drives the same results", async ({ page, isMobile }) => {
    await visit(page, "/demo/stays");
    if (isMobile) await page.getByText("Filters", { exact: false }).first().click();
    const prefix = isMobile ? "#m" : "#d";
    await page.locator(`${prefix}-category`).selectOption("farm-stay");
    await page.locator(`${prefix}-category`).locator("xpath=ancestor::form").getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/category=farm-stay/);
    await expect(cards(page)).toHaveCount(2);
  });

  test("the search bar validates dates and guests before leaving the page", async ({ page }) => {
    await visit(page, "/demo/stays");
    const form = page.getByRole("search", { name: "Search stays" });
    await form.locator('input[name="checkin"]').fill(iso(plus(new Date(), 10)));
    await form.getByRole("button", { name: "Search Stays" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Select a check-out date." })).toBeVisible();
    await form.locator('input[name="checkout"]').fill(iso(plus(new Date(), 8)));
    await form.getByRole("button", { name: "Search Stays" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Check-out must be after check-in." })).toBeVisible();
    await form.locator('input[name="checkout"]').fill(iso(plus(new Date(), 12)));
    await form.locator('input[name="guests"]').fill("0");
    await form.getByRole("button", { name: "Search Stays" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "between 1 and 500" })).toBeVisible();
    await expect(page).toHaveURL(/\/demo\/stays$/);
  });

  test("a date range inside a demo block hides that listing", async ({ page }) => {
    // Green Valley Farm Stay is blocked from day 12 to day 15 in the demo data.
    const ci = iso(plus(new Date(), 13));
    const co = iso(plus(new Date(), 14));
    await visit(page, `/demo/stays?checkin=${ci}&checkout=${co}`);
    await expect(cards(page)).toHaveCount(5);
    await expect(page.getByRole("heading", { level: 3, name: "Green Valley Farm Stay" })).toHaveCount(0);
  });
});

test.describe("demo mode: property details and illustrative booking", () => {
  test("shows the full demonstration detail page with the required notice and badge", async ({ page }) => {
    await visit(page, "/demo/stays/demo-countryside-garden-cottage");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Countryside Garden Cottage");
    await expect(page.getByTestId("demo-notice")).toContainText(NOTICE);
    await expect(page.getByTestId("demo-notice")).toContainText("Demo listing — sample data");
    await expect(page.getByRole("heading", { name: "About this stay" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Amenities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Prices/ })).toContainText("illustrative demo values");
    await expect(page.getByRole("heading", { name: "Availability" })).toBeVisible();
    await expect(page.getByText("Demo house rules:")).toBeVisible();
    await expect(page.getByText(/Check-in from 13:00; check-out by 11:00/)).toBeVisible();
    await expect(page.getByText(/Up to 3 guests/).first()).toBeVisible();
    await expect(page.getByText(/1 bedroom/).first()).toBeVisible();
    await expect(page.getByText(/demonstration location, not a real address/)).toBeVisible();
    await expect(page.locator("#booking")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test("every one of the six detail pages loads with its name and the notice", async ({ page }) => {
    await visit(page, "/demo/stays");
    const hrefs = await cards(page).getByRole("link", { name: "View Details", exact: true }).evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    expect(hrefs).toHaveLength(6);
    for (const [i, href] of hrefs.entries()) {
      const res = await visit(page, href);
      expect(res?.status(), href).toBe(200);
      await expect(page.getByTestId("demo-notice"), href).toContainText(NOTICE);
      await expect(page.getByRole("heading", { level: 1 }), href).not.toHaveText("");
      expect(NAMES).toContain((await page.getByRole("heading", { level: 1 }).innerText()).trim());
      void i;
    }
  });

  test("an unknown demo listing is a proper 404", async ({ page }) => {
    expect((await visit(page, "/demo/stays/not-a-listing"))?.status()).toBe(404);
  });

  test("calculates nights and the illustrative total correctly (weekday, weekend, per-guest)", async ({ page }) => {
    // Countryside Garden Cottage: 5200 weekday, 6200 weekend (Fri/Sat). Mon->Wed = 2 weekday nights = 10,400. Fri->Sun = 12,400.
    const monday = nextWeekday(1);
    await visit(page, "/demo/stays/demo-countryside-garden-cottage");
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await expect(page.getByTestId("booking-quote")).toContainText("2 nights · 2 guests");
    await expect(page.getByTestId("booking-total")).toHaveText("₹10,400");
    const friday = nextWeekday(5);
    await page.locator("#check_in").fill(iso(friday));
    await page.locator("#check_out").fill(iso(plus(friday, 2)));
    await expect(page.getByTestId("booking-total")).toHaveText("₹12,400");
    await expect(page.getByTestId("booking-quote")).toContainText("2 at weekend rate");
    // No taxes or fees are shown because this listing defines none.
    await expect(page.getByTestId("booking-quote")).not.toContainText(/Taxes|Cleaning/);

    await visit(page, "/demo/stays/demo-organic-farm-experience"); // 1,600 per guest per night
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await page.locator("#adults").fill("3");
    await expect(page.getByTestId("booking-total")).toHaveText("₹9,600");

    await visit(page, "/demo/stays/demo-forest-edge-eco-retreat"); // 7,500 + 800 cleaning fee, 2-night minimum
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await expect(page.getByTestId("booking-quote")).toContainText("Cleaning fee");
    await expect(page.getByTestId("booking-total")).toHaveText("₹15,800");
  });

  test("validates guest capacity, dates and minimum stay", async ({ page }) => {
    const monday = nextWeekday(1);
    await visit(page, "/demo/stays/demo-countryside-garden-cottage"); // sleeps 3
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await page.locator("#adults").fill("3");
    await page.locator("#children").fill("1");
    await expect(page.getByTestId("booking-problem")).toContainText("sleeps up to 3 guests");
    await expect(page.getByRole("button", { name: "Request to book (demo)" })).toBeDisabled();
    await page.locator("#children").fill("0");
    await expect(page.getByTestId("booking-problem")).toHaveCount(0);
    await page.locator("#check_out").fill(iso(monday));
    await expect(page.getByTestId("booking-problem")).toContainText("Check-out must be after check-in");
    await visit(page, "/demo/stays/demo-riverside-nature-escape"); // minimum 2 nights
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 1)));
    await expect(page.getByTestId("booking-problem")).toContainText("at least 2 nights");
  });

  test("the demo 'booking' is honest: it says nothing was saved and never claims success", async ({ page }) => {
    const monday = nextWeekday(1);
    await visit(page, "/demo/stays/demo-countryside-garden-cottage");
    const button = page.getByRole("button", { name: "Request to book (demo)" });
    await expect(button).toBeDisabled();
    await page.locator("#check_in").fill(iso(monday));
    await page.locator("#check_out").fill(iso(plus(monday, 2)));
    await button.click();
    await expect(page.getByTestId("demo-booking-note")).toContainText("nothing was saved");
    await expect(page.getByTestId("demo-booking-note")).toContainText("No booking request was created");
    await expect(page.locator("main")).not.toContainText(/booking (confirmed|successful)|request sent/i);
  });

  test("the date and guest choices in the URL are pre-filled (what survives a return from sign-in)", async ({ page }) => {
    const monday = nextWeekday(1);
    await visit(page, `/demo/stays/demo-countryside-garden-cottage?checkin=${iso(monday)}&checkout=${iso(plus(monday, 2))}&guests=2#booking`);
    await expect(page.locator("#check_in")).toHaveValue(iso(monday));
    await expect(page.locator("#check_out")).toHaveValue(iso(plus(monday, 2)));
    await expect(page.locator("#adults")).toHaveValue("2");
    await expect(page.getByTestId("booking-total")).toHaveText("₹10,400");
  });
});

test.describe("layouts", () => {
  for (const [name, size] of [["tablet", { width: 768, height: 1024 }], ["phone", { width: 375, height: 812 }], ["desktop", { width: 1280, height: 900 }]] as const) {
    test(`${name}: demo pages have no horizontal overflow and tappable booking buttons`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const path of ["/demo/stays", "/demo/stays/demo-weekend-cycling-retreat"]) {
        await visit(page, path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${name} ${path}`).toBeLessThanOrEqual(1);
      }
      await visit(page, "/demo/stays");
      for (const link of await cards(page).first().getByRole("link", { name: /View Details|Book Now/ }).all()) {
        const box = await link.boundingBox();
        expect(box!.height, "tap target height").toBeGreaterThanOrEqual(40);
        expect(box!.width, "tap target width").toBeGreaterThanOrEqual(80);
      }
      const img = cards(page).first().locator("img").first();
      const [iw, cw] = [(await img.boundingBox())!.width, (await cards(page).first().boundingBox())!.width];
      expect(iw).toBeLessThanOrEqual(cw + 1); // image fits the card
    });
  }
});

test.describe("live Explore Stays without a database", () => {
  test("says so, offers demo mode and Retry-less honesty, and shows no invented listings", async ({ page }) => {
    await visit(page, "/stays");
    await expect(page.locator("main")).toContainText(/hasn't been connected|coming online shortly/i);
    await expect(page.getByRole("link", { name: "Open demo mode" })).toHaveAttribute("href", "/demo/stays");
    await expect(page.getByTestId("stay-card")).toHaveCount(0);
  });
});

test.describe("selection survives sign-in (server with a configured, unreachable backend)", () => {
  test.use({ baseURL: `http://localhost:${FORMS_PORT}` });
  const next = "/stays/demo-green-valley-farm-stay?checkin=2026-12-07&checkout=2026-12-10&guests=3#booking";
  for (const path of ["/sign-in", "/sign-up"]) {
    test(`${path} keeps the destination in its form and Google button`, async ({ page }) => {
      await visit(page, `${path}?next=${encodeURIComponent(next)}`);
      const values = await page.locator('input[name="next"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
      expect(values.length).toBeGreaterThanOrEqual(2); // the form and the Google button
      for (const v of values) expect(v).toBe(next);
    });
  }
  test("an off-site destination is dropped, not carried", async ({ page }) => {
    await visit(page, `/sign-in?next=${encodeURIComponent("https://evil.example/steal")}`);
    expect(await page.locator('input[name="next"]').count()).toBe(0);
  });
});
