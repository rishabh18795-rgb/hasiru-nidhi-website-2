import { expect, test } from "@playwright/test";

import { visit } from "./helpers";

/** Shop with the marketplace flag OFF (and no backend): every URL is honest, indexable nowhere, and shows nothing for sale. */
test.describe("shop while the module is OFF", () => {
  for (const path of ["/shop", "/shop/all", "/shop/plants-seeds-saplings", "/shop/p/anything-at-all", "/vendors/some-seller", "/shop/all?q=rose&pin=560078"]) {
    test(`${path} says the Shop is opening soon and offers real alternatives`, async ({ page }) => {
      const res = await visit(page, path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/opening soon/i);
      await expect(page.locator("main")).toContainText(/nothing is for sale yet/i);
      await expect(page.locator('main a[href="/stays"]').first()).toBeVisible();
      await expect(page.getByTestId("product-card")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /add to cart|buy now|checkout/i })).toHaveCount(0);
    });
  }

  test("is not indexed while closed", async ({ page }) => {
    await visit(page, "/shop");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("has no horizontal overflow on a phone-sized screen", async ({ page }) => {
    await visit(page, "/shop");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test("the marketplace admin and vendor product pages are protected", async ({ page }) => {
    for (const path of ["/admin/products", "/admin/product-categories"]) {
      await visit(page, path);
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
    }
    for (const path of ["/vendor/products", "/vendor/products/new", "/vendor/inventory"]) {
      await visit(page, path);
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fvendor/);
    }
  });
});
