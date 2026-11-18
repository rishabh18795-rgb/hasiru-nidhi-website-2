import { expect, test } from "@playwright/test";

import { FORMS_PORT } from "../../playwright.config";
import { visit } from "./helpers";

// Homepage, gardening, PIN-code search and portal logins. The first group needs no backend; the second renders real forms
// against the dummy, unreachable Supabase (see playwright.config.ts).

test.describe("homepage", () => {
  test("no longer carries the 45-minutes claim or a statistics row", async ({ page }) => {
    await visit(page, "/");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/45\s*(–|-)?\s*(60)?\s*min/i);
    expect(text).not.toMatch(/minutes from central/i);
    expect(text).not.toMatch(/an hour from bengaluru/i);
  });

  test("has the Gardening Services section, separate from stay search, with a working Enquire Now link", async ({ page }) => {
    await visit(page, "/");
    const section = page.locator("#gardening-services");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { level: 2 })).toContainText("Gardens designed, planted and cared for");
    const enquire = section.locator('a[href="/gardening#enquire"]');
    await expect(enquire).toBeVisible();
    await expect(enquire).toContainText("Enquire Now");
    await expect(section.getByRole("search")).toHaveCount(0);
    await expect(section.getByText(/never create a stay booking/i)).toBeVisible();
    await expect(section.locator("ul[aria-label='Gardening services'] li")).not.toHaveCount(0);
    await enquire.click();
    await expect(page).toHaveURL(/\/gardening#enquire$/);
    await expect(page.locator("#enquire")).toBeVisible();
  });

  test("the hero search has PIN code, location, dates and guests, and host registration is one click away", async ({ page }) => {
    await visit(page, "/");
    const search = page.getByRole("search", { name: "Search stays" });
    for (const label of ["Location", "PIN code", "Check-in", "Check-out", "Guests"]) await expect(search.getByText(label, { exact: true })).toBeVisible();
    await expect(page.locator('a[href="/host/register"]').first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancellation Policy" }).first()).toHaveAttribute("href", "/cancellation-policy");
  });

  test("the search refuses a malformed PIN before leaving the page", async ({ page }) => {
    await visit(page, "/");
    const search = page.getByRole("search", { name: "Search stays" });
    await search.getByLabel("PIN code").fill("56A1");
    await search.getByRole("button", { name: "Search Stays" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("alert").filter({ hasText: "6-digit PIN" })).toBeVisible();
  });

  test("the About page and FAQ no longer state a travel time", async ({ page }) => {
    for (const path of ["/about", "/faq"]) {
      await visit(page, path);
      await expect(page.locator("main")).not.toContainText(/45\s*(–|-)?\s*(60)?\s*min(ute)?s?\s+(from|away)/i);
    }
  });
});

test.describe("PIN-code search (demo mode, same rules as the database)", () => {
  test("an exact PIN shows only that stay; an unrelated PIN shows a clear empty state", async ({ page }) => {
    await visit(page, "/demo/stays?pin=562117");
    await expect(page.getByRole("heading", { name: "Green Valley Farm Stay" }).first()).toBeVisible();
    await expect(page.getByText("Countryside Garden Cottage")).toHaveCount(0);
    await expect(page.getByText(/for PIN 562117/)).toBeVisible();
    await visit(page, "/demo/stays?pin=110001");
    await expect(page.getByText("No demo stays match those filters")).toBeVisible();
    await expect(page.getByText("Green Valley Farm Stay")).toHaveCount(0);
  });

  test("typing a PIN in the search form finds the stay", async ({ page }) => {
    await visit(page, "/demo/stays");
    const search = page.getByRole("search", { name: "Search stays" });
    await search.getByLabel("PIN code").fill("562110");
    await search.getByRole("button", { name: "Search Stays" }).click();
    await expect(page).toHaveURL(/pin=562110/);
    await expect(page.getByRole("heading", { name: "Countryside Garden Cottage" }).first()).toBeVisible();
  });

  test("a PIN in the live Explore Stays page never invents results when the backend is down", async ({ page }) => {
    await visit(page, "/stays?pin=562117");
    await expect(page.getByText("Green Valley Farm Stay")).toHaveCount(0);
  });
});

test.describe("gardening services page", () => {
  test("has services, how it works and the enquiry form with PIN, date and time", async ({ page }) => {
    await visit(page, "/gardening");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gardens designed, planted and cared for");
    await expect(page.locator("#enquire")).toBeVisible();
    for (const id of ["#g-name", "#g-phone", "#g-email", "#g-location", "#g-pin", "#g-type", "#g-date", "#g-time", "#g-req"]) await expect(page.locator(id)).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/book(ing)? (a )?stay/i);
  });

  test("validates before anything is sent: no fake success", async ({ page }) => {
    await visit(page, "/gardening");
    await page.getByRole("button", { name: "Send gardening enquiry" }).click();
    await expect(page.locator("#enquire").getByRole("alert").first()).toBeVisible();
    await expect(page.locator("#enquire")).not.toContainText(/thank you/i);
  });
});

test.describe("portal logins with a configured (dummy) backend", () => {
  test.use({ baseURL: `http://localhost:${FORMS_PORT}` });

  test("host login: Google, password toggle, link to host registration and customer sign-in", async ({ page }) => {
    await visit(page, "/host/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Host login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a host account" })).toHaveAttribute("href", "/host/register");
    await expect(page.getByRole("link", { name: "Customer sign in" })).toHaveAttribute("href", "/sign-in");
  });

  test("host registration is host-only and links back to host login", async ({ page }) => {
    await visit(page, "/host/register");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your host account");
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.locator('[name="account_type"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Host login" })).toHaveAttribute("href", "/host/login");
  });

  test("admin login: no Google, no sign-up, no role field; a wrong password is refused with a generic message", async ({ page }) => {
    await visit(page, "/admin/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Administrator sign in");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /create (a|an)|sign up|register/i })).toHaveCount(0);
    await expect(page.locator("select, [name='role'], [name='account_type']")).toHaveCount(0);
    await page.locator("#email").fill("someone@example.test");
    await page.locator("#password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a signed-out visitor to /admin is sent to the administrator login, keeping the destination", async ({ page }) => {
    await visit(page, "/admin/payments");
    await expect(page).toHaveURL(/\/admin\/login\?next=(%2F|\/)admin(%2F|\/)payments/);
  });

  test("an open redirect through the portal login is not followed", async ({ page }) => {
    await visit(page, "/host/login?next=https://evil.example");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });
});

test.describe("payment webhook route", () => {
  test("answers 503 (never a fake success) while no payment provider is integrated", async ({ request }) => {
    const res = await request.post("/api/payments/webhook/razorpay", { data: "{}", headers: { "x-signature": "abc" } });
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "payments_not_enabled" });
  });
  test("refuses odd provider names", async ({ request }) => {
    expect((await request.post("/api/payments/webhook/..%2Fadmin", { data: "{}" })).status()).toBe(404);
  });
});
