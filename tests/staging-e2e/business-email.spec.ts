import { expect, test } from "@playwright/test";

/** The owner-confirmed official business e-mail must be the contact address everywhere it is shown. */
const EMAIL = "hasirunidhiofficial@gmail.com";

for (const path of ["/contact", "/privacy", "/terms", "/faq"]) {
  test(`${path} shows the official business e-mail as a mailto link`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(`a[href="mailto:${EMAIL}"]`).first()).toBeVisible();
  });
}

test("footer shows the official e-mail and no other mailto address appears on the contact page", async ({ page }) => {
  await page.goto("/contact");
  const hrefs = await page.locator('a[href^="mailto:"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h).toBe(`mailto:${EMAIL}`);
});
