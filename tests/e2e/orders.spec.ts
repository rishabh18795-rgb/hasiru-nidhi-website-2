import { expect, test } from "@playwright/test";

import { visit } from "./helpers";

/** Cart, checkout and orders with the marketplace flags OFF and no backend: everything is protected or honestly closed. */
test.describe("cart, checkout and orders (flags OFF, no backend)", () => {
  for (const [path, next] of [["/cart", "%2Fcart"], ["/checkout", "%2Fcheckout"], ["/checkout/confirmation/abc", "%2Fcheckout%2Fconfirmation%2Fabc"], ["/dashboard/orders", "%2Fdashboard%2Forders"], ["/dashboard/addresses", "%2Fdashboard%2Faddresses"], ["/vendor/orders", "%2Fvendor%2Forders"]] as const) {
    test(`${path} sends a signed-out visitor to sign-in and keeps the destination`, async ({ page }) => {
      await visit(page, path);
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${next}`));
    });
  }
  test("the admin order pages are protected by the admin login", async ({ page }) => {
    for (const path of ["/admin/orders", "/admin/orders?view=requests", "/admin/order-policies"]) {
      await visit(page, path);
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
    }
  });
  test("no cart or checkout link, and no payment wording, is exposed publicly while ordering is closed", async ({ page }) => {
    await visit(page, "/shop");
    for (const href of ["/cart", "/checkout"]) await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/payment (received|successful)|transaction id/i);
  });
});
