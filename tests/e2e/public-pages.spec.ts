import { expect, test } from "@playwright/test";

import { visit } from "./helpers";

const PAGES = ["/nature-stay", "/cycling", "/experiences", "/packages", "/pricing", "/gallery", "/blog", "/blog/the-slow-case-for-cycling-through-farmland"];

test.describe("the seven completed public pages", () => {
  const titles = new Map<string, string>();

  for (const path of PAGES) {
    test(`${path}: one h1, unique title, described images, no overflow, valid internal links`, async ({ page }) => {
      const res = await visit(page, path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(titles.get(title), `duplicate title with ${titles.get(title)}`).toBeUndefined();
      titles.set(title, path);

      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length ?? 0).toBeGreaterThan(40);
      expect(description!.length).toBeLessThanOrEqual(160);

      const missingAlt = await page.locator("main img:not([alt])").count();
      expect(missingAlt, "images without an alt attribute").toBe(0);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      const hrefs = await page.locator("main a[href^='/']").evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!))]);
      for (const href of hrefs) {
        const r = await page.request.get(href.replace(/#.*$/, ""));
        expect(r.status(), `${href} on ${path}`).toBeLessThan(400);
      }
    });
  }

  test("pricing is transparent that online payment is not available", async ({ page }) => {
    await visit(page, "/pricing");
    await expect(page.locator("main")).toContainText(/online payment is not set up/i);
    await expect(page.locator("main")).not.toContainText(/₹\s?\d/);
  });

  test("packages are enquiry-led and prefill the enquiry form", async ({ page }) => {
    await visit(page, "/packages");
    await expect(page.locator("main")).toContainText(/confirmed by our team when you enquire/i);
    await page.locator('main a[href="/book?package=farmhouse-overnight"]').click();
    await expect(page).toHaveURL(/\/book\?package=farmhouse-overnight/);
    await expect(page.locator("textarea").first()).toHaveValue(/A night on the farm/);
  });
});

test.describe("gallery", () => {
  test("filters by category, opens a lightbox, navigates by keyboard and button, and closes with Escape", async ({ page }) => {
    await visit(page, "/gallery");
    const count = page.getByTestId("gallery-count");
    await expect(count).toContainText("Showing 21 photographs");

    await page.getByRole("button", { name: "Cycling", exact: true }).click();
    await expect(count).toContainText("Showing 3 photographs in Cycling");
    await expect(page.getByRole("button", { name: "Cycling", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /Open photograph/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Photograph viewer" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Photograph 1 of 3");

    await page.keyboard.press("ArrowRight");
    await expect(dialog).toContainText("Photograph 2 of 3");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toContainText("Photograph 1 of 3");
    await dialog.getByRole("button", { name: "Next photograph" }).click();
    await expect(dialog).toContainText("Photograph 2 of 3");
    await dialog.getByRole("button", { name: "Previous photograph" }).click();
    await dialog.getByRole("button", { name: "Previous photograph" }).click();
    await expect(dialog).toContainText("Photograph 3 of 3");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(count).toContainText("Showing 21 photographs");
  });

  test("states plainly that the photographs are illustrative", async ({ page }) => {
    await visit(page, "/gallery");
    await expect(page.locator("main")).toContainText(/illustrative/i);
  });
});
