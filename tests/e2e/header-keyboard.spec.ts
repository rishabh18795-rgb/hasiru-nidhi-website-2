import { expect, test } from "@playwright/test";

/** The header sub-menus must work without a mouse: open on focus, reachable with Tab, dismissed with Escape. */
test.use({ viewport: { width: 1440, height: 900 } });

test("a header sub-menu opens from the keyboard, its links are reachable, and Escape closes it", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.locator("header");
  const plan = nav.getByRole("link", { name: /^Plan/ });
  await plan.focus();
  await expect(plan).toHaveAttribute("aria-expanded", "true");
  const packages = nav.getByRole("link", { name: "Packages" });
  await expect(packages).toBeVisible();
  await page.keyboard.press("Tab"); // into the sub-menu
  await expect(packages).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(packages).toHaveCount(0);
  await expect(plan).toHaveAttribute("aria-expanded", "false");
});

test("tabbing out of a sub-menu closes it", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.locator("header");
  await nav.getByRole("link", { name: /^About/ }).focus();
  await expect(nav.getByRole("link", { name: "Journal" })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab"); // past Journal, Contact, and on
  await expect(nav.getByRole("link", { name: "Journal" })).toHaveCount(0);
});
