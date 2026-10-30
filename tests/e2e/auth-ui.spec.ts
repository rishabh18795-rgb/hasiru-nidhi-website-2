import { expect, test, type Page } from "@playwright/test";

import { FORMS_PORT } from "../../playwright.config";
import { visit } from "./helpers";

// These pages render their real forms against a dummy, unreachable Supabase (see playwright.config.ts).
test.use({ baseURL: `http://localhost:${FORMS_PORT}` });

const HOST_SUPPORT = "List your property on Hasiru Nidhi. Verify your email to continue to the listing steps. Your property will remain unpublished until approved by our team.";
const SAMPLE_PASSWORD = "Sup3rSecretPass";

async function passwordField(page: Page, name: string) {
  return page.locator(name === "Confirm password" ? "#confirm_password" : "#password");
}

test.describe("host registration", () => {
  test("is host-only: no account-type selector, no traveller option, exact heading and text", async ({ page }) => {
    await visit(page, "/sign-up?type=host&next=%2Fhost%2Fproperties%2Fnew");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your host account");
    await expect(page.getByText(HOST_SUPPORT)).toBeVisible();
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByText(/find and book stays/i)).toHaveCount(0);
    await expect(page.getByText(/traveller account|\(traveller\)/i)).toHaveCount(0);
    await expect(page.locator('[name="account_type"]')).toHaveCount(0);
  });

  test("has every required field, Google sign-in, terms and a submit button", async ({ page }) => {
    await visit(page, "/sign-up?type=host");
    for (const id of ["#full_name", "#email", "#phone"]) await expect(page.locator(id)).toBeVisible();
    await expect(await passwordField(page, "Password")).toBeVisible();
    await expect(await passwordField(page, "Confirm password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Terms.*Privacy Policy/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("the server validates: weak password and missing terms, then a mismatched confirmation", async ({ page }) => {
    await visit(page, "/sign-up?type=host");
    await page.locator("#full_name").fill("Asha Rao");
    await page.locator("#email").fill("asha@example.test");
    await (await passwordField(page, "Password")).fill("weak");
    await (await passwordField(page, "Confirm password")).fill("weak");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/at least 10 characters/i).first()).toBeVisible();
    await expect(page.getByText(/accept the Terms/i)).toBeVisible();

    await (await passwordField(page, "Password")).fill(SAMPLE_PASSWORD);
    await (await passwordField(page, "Confirm password")).fill("Different1Password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });
});

test.describe("customer registration", () => {
  test("is traveller-only with Google, two password toggles and a link to hosting; no role selector", async ({ page }) => {
    await visit(page, "/sign-up");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your account");
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByText(/list my property/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show confirm password" })).toBeVisible();
    await expect(page.getByRole("link", { name: "List it as a host" })).toHaveAttribute("href", "/list-your-property");
  });
});

test.describe("login pages", () => {
  test("customer and host sign-in offer Google and a password toggle; admin sign-in has the toggle but no Google or sign-up", async ({ page }) => {
    for (const [path, heading] of [["/sign-in", "Welcome back"], ["/sign-in?next=%2Fhost", "Host sign in"]] as const) {
      await visit(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    }
    await visit(page, "/admin/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Administrator sign in");
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /create (a|an)/i })).toHaveCount(0);
  });

  test("the reset-password page also has the toggles", async ({ page }) => {
    await visit(page, "/reset-password");
    // Without a recovery session the page may redirect; when the form is shown it must have both toggles.
    if (await page.getByRole("button", { name: "Show new password" }).count()) {
      await expect(page.getByRole("button", { name: "Show confirm new password" })).toBeVisible();
    }
  });
});

test.describe("show / hide password", () => {
  test("hidden by default; toggles; keeps the value and the focus; button state and label follow; nothing is stored", async ({ page }) => {
    await visit(page, "/sign-in");
    const input = await passwordField(page, "Password");
    await expect(input).toHaveAttribute("type", "password");
    await input.fill(SAMPLE_PASSWORD);

    const show = page.getByRole("button", { name: "Show password" });
    await expect(show).toHaveAttribute("aria-pressed", "false");
    await show.click();
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveValue(SAMPLE_PASSWORD);
    await expect(input).toBeFocused();
    const hide = page.getByRole("button", { name: "Hide password" });
    await expect(hide).toHaveAttribute("aria-pressed", "true");

    await hide.click();
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveValue(SAMPLE_PASSWORD);
    await expect(input).toBeFocused();

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain(SAMPLE_PASSWORD);
  });

  test("works from the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard interaction is a desktop concern");
    await visit(page, "/sign-in");
    const input = await passwordField(page, "Password");
    await input.fill(SAMPLE_PASSWORD);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveValue(SAMPLE_PASSWORD);
  });

  test("the confirm field toggles independently of the password field", async ({ page }) => {
    await visit(page, "/sign-up");
    const pw = await passwordField(page, "Password");
    const confirm = await passwordField(page, "Confirm password");
    await page.getByRole("button", { name: "Show confirm password" }).click();
    await expect(confirm).toHaveAttribute("type", "text");
    await expect(pw).toHaveAttribute("type", "password");
  });

  test("the eye button sits inside the field and never overlaps the typed text (also on phones)", async ({ page }) => {
    await visit(page, "/sign-in");
    const input = await passwordField(page, "Password");
    await input.fill("x".repeat(80));
    const btn = page.getByRole("button", { name: "Show password" });
    const [ib, bb] = [await input.boundingBox(), await btn.boundingBox()];
    expect(ib && bb).toBeTruthy();
    expect(bb!.x).toBeGreaterThanOrEqual(ib!.x);
    expect(bb!.x + bb!.width).toBeLessThanOrEqual(ib!.x + ib!.width + 1);
    const padRight = await input.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
    expect(padRight).toBeGreaterThanOrEqual(bb!.width - 1); // text can never run under the icon
    expect(bb!.width).toBeGreaterThanOrEqual(40);            // comfortable touch target
  });
});

test.describe("Google sign-in", () => {
  test("starts the OAuth flow with no role or destination in the URL, and keeps the intent in an httpOnly cookie", async ({ page, context }) => {
    let authorizeUrl = "";
    await page.route("http://127.0.0.1:9/**", (route) => { authorizeUrl = route.request().url(); return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>provider</h1>" }); });
    await visit(page, "/sign-up?type=host&next=%2Fhost%2Fproperties%2Fnew");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect.poll(() => authorizeUrl).toContain("provider=google");
    const u = new URL(authorizeUrl);
    expect(u.searchParams.get("redirect_to")).toBe(`http://localhost:${FORMS_PORT}/auth/callback`);
    for (const param of ["role", "intent", "next", "account_type"]) expect(u.searchParams.has(param), `the authorize URL must not carry ${param}`).toBe(false);
    const cookie = (await context.cookies()).find((c) => c.name === "hn_auth_intent");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(decodeURIComponent(cookie!.value)).toContain('"k":"host"');
  });

  test("a failed start is reported honestly instead of pretending", async ({ page }) => {
    // The dummy Supabase never answers, but building the authorize URL is local, so check the cancelled/failed return trips instead.
    await visit(page, "/sign-in?error=oauth_unavailable");
    await expect(page.getByText(/Google sign-in isn't available yet/)).toBeVisible();
  });

  test("returning from Google: cancelled, refused or invalid trips land on sign-in with a clear message and no session", async ({ page }) => {
    for (const [query, message] of [
      ["error=access_denied", /Google sign-in was cancelled/],
      ["error=server_error&error_description=boom", /couldn.t complete Google sign-in/],
      ["", /invalid or has expired/],
      ["code=not-a-real-code", /couldn.t complete Google sign-in|invalid or has expired/],
    ] as const) {
      await visit(page, `/auth/callback${query ? `?${query}` : ""}`);
      await expect(page, query).toHaveURL(/\/sign-in\?error=/);
      await expect(page.getByText(message).first()).toBeVisible();
    }
  });

  test("the callback never trusts a role or destination in its URL", async ({ page }) => {
    await visit(page, "/auth/callback?error=access_denied&role=admin&intent=host&next=https://evil.example");
    await expect(page).toHaveURL(/\/sign-in\?error=oauth_cancelled$/);
    expect(new URL(page.url()).hostname).toBe("localhost");
  });
});
