import { expect, test } from "@playwright/test";

import { visit } from "./helpers";

test.describe("vendor area (marketplace flags OFF, no backend)", () => {
  for (const path of ["/vendor", "/vendor/profile", "/vendor/verification", "/vendor/coverage", "/vendor/apply"]) {
    test(`${path} sends a signed-out visitor to sign-in and keeps the destination`, async ({ page }) => {
      await visit(page, path);
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fvendor/);
    });
  }

  test("the admin vendor pages are protected by the admin login", async ({ page }) => {
    for (const path of ["/admin/vendors", "/admin/marketplace"]) {
      await visit(page, path);
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
    }
  });

  test("the public vendor page is honest that registration is not open, offers real alternatives, and is not indexed", async ({ page }) => {
    await visit(page, "/become-a-vendor");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main")).toContainText(/not open yet/i);
    await expect(page.getByRole("link", { name: /start your application/i })).toHaveCount(0);
    await expect(page.locator('a[href="/become-a-host"]').first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("nothing in the public navigation exposes an unfinished marketplace module", async ({ page }) => {
    await visit(page, "/");
    for (const href of ["/shop", "/services", "/vendor", "/cart", "/checkout"]) await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  });
});
