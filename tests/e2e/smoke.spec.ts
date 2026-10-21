import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/stays", "/experiences", "/cycling", "/gardening-landscaping", "/about", "/gallery", "/list-your-property", "/become-a-host", "/contact", "/sign-in", "/sign-up", "/forgot-password", "/privacy", "/terms", "/cancellation-policy"];

test.describe("public site", () => {
  test("home page carries the brand headline, tagline and a working stay search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Escape the City.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Embrace Nature.");
    await expect(page.getByText("Cultivating Nature, Creating Memories.").first()).toBeVisible();

    const search = page.locator('form[aria-label="Search stays"]');
    await search.locator('input[name="q"]').fill("Nandi Hills");
    await search.locator('input[name="guests"]').fill("3");
    await search.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/stays\?.*q=Nandi(\+|%20)Hills/);
    await expect(page).toHaveURL(/guests=3/);
  });

  for (const path of PUBLIC_PAGES) {
    test(`${path} renders (HTTP 200, a heading, no horizontal overflow)`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(1);
    });
  }

  test("unknown URLs get the custom 404 page", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /wandered off the trail/i })).toBeVisible();
  });
});

test.describe("backend-unavailable states are honest", () => {
  test("sign-in, sign-up and stays explain that the backend is not connected instead of faking it", async ({ page }) => {
    for (const path of ["/sign-in", "/sign-up", "/stays"]) {
      await page.goto(path);
      await expect(page.locator("main")).toContainText(/hasn't been connected|coming online shortly|not (yet )?configured/i);
    }
  });

  test("the contact form validates on the server and never reports success it did not achieve", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: /send/i }).first().click();
    await expect(page.locator("main")).not.toContainText(/thank you|message sent/i);
  });
});

test.describe("protected areas", () => {
  for (const path of ["/dashboard", "/dashboard/bookings", "/host", "/host/properties/new", "/admin", "/admin/audit-logs", "/admin/reviews"]) {
    test(`${path} sends signed-out visitors to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in\?next=/);
    });
  }

  test("portal entry aliases land on the right page", async ({ page }) => {
    await page.goto("/host/register");
    await expect(page).toHaveURL(/\/sign-up\?type=host/);
    await page.goto("/host/login");
    await expect(page).toHaveURL(/\/sign-in\?next=(%2F|\/)host/);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });

  test("open redirects through ?next= are refused", async ({ page }) => {
    await page.goto("/sign-in?next=https://evil.example");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });
});

test.describe("security and SEO", () => {
  test("every response carries the security headers", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("private areas are noindex, disallowed in robots.txt and absent from the sitemap", async ({ page, request }) => {
    await page.goto("/sign-in");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const robots = await (await request.get("/robots.txt")).text();
    for (const p of ["/dashboard", "/host", "/admin"]) expect(robots).toContain(`Disallow: ${p}`);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const p of ["/dashboard", "/host/", "/admin", "/sign-in"]) expect(sitemap).not.toContain(p);
    expect(sitemap).toContain("/stays");
  });
});
