import { expect, test, type Page } from "@playwright/test";

import { visit } from "./helpers";

const bar = (page: Page) => page.getByRole("search", { name: "Search stays" });
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test.describe("home search bar", () => {
  test("every field has a visible label and a clear placeholder, and the button says Search Stays", async ({ page }) => {
    await visit(page, "/");
    const form = bar(page);
    for (const label of ["Location", "Check-in", "Check-out", "Guests"]) await expect(form.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(form.getByPlaceholder("Enter city, region or property name")).toBeVisible();
    await expect(form.getByPlaceholder("Number of guests")).toBeVisible();
    await expect(form.getByText("Select check-in date")).toBeVisible();
    await expect(form.getByText("Select check-out date")).toBeVisible();
    await expect(form.getByRole("button", { name: "Search Stays" })).toBeVisible();
    await expect(form.getByText("dd/mm/yyyy")).toHaveCount(0);
  });

  test("refuses impossible input with a clear message and stays on the page", async ({ page }) => {
    await visit(page, "/");
    const form = bar(page);
    const submit = form.getByRole("button", { name: "Search Stays" });

    await form.locator('input[name="checkin"]').fill(iso(5));
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "Select a check-out date." })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await form.locator('input[name="checkout"]').fill(iso(3));
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "Check-out must be after check-in." })).toBeVisible();

    await form.locator('input[name="checkout"]').fill(iso(7));
    await form.locator('input[name="guests"]').fill("0");
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "between 1 and 500" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a valid search goes to /stays with the filters in the URL", async ({ page }) => {
    await visit(page, "/");
    const form = bar(page);
    await form.locator('input[name="q"]').fill("Coorg");
    await form.locator('input[name="checkin"]').fill(iso(10));
    await form.locator('input[name="checkout"]').fill(iso(12));
    await form.locator('input[name="guests"]').fill("3");
    await form.getByRole("button", { name: "Search Stays" }).click();
    await expect(page).toHaveURL(new RegExp(`/stays\\?.*q=Coorg.*checkin=${iso(10)}.*checkout=${iso(12)}.*guests=3`));
  });

  test("an empty search browses all stays; with no backend the stays page says so honestly", async ({ page }) => {
    await visit(page, "/");
    await bar(page).getByRole("button", { name: "Search Stays" }).click();
    await expect(page).toHaveURL(/\/stays/);
    await expect(page.locator("main")).toContainText(/hasn't been connected|coming online shortly|no stays|couldn't load/i);
  });
});
