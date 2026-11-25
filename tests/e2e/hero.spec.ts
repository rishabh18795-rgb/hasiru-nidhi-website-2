import { expect, test, type Page } from "@playwright/test";

/**
 * The home-page hero must show its photograph and its words on the very first paint, not after the visitor scrolls or the page's
 * JavaScript has loaded. (Regression: the photograph was optimised on demand, so the first visitor saw a flat dark gradient, and the
 * hero text started hidden until JavaScript hydrated it.)
 */
async function heroState(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("section img[fetchpriority='high']");
    const h1 = document.querySelector("h1");
    return {
      imgLoaded: Boolean(img && img.complete && img.naturalWidth > 0),
      imgSrc: img?.currentSrc ?? "",
      h1Opacity: h1 ? Number(getComputedStyle(h1.closest(".hero-rise") ?? h1).opacity) : -1,
      h1Visible: h1 ? h1.getBoundingClientRect().height > 0 : false,
    };
  });
}

test("hero photograph and headline are painted on first load, with no console errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(900); // the CSS rise animation is 0.55s plus a 0.04 to 0.18s stagger
  const s = await heroState(page);
  expect(s.imgLoaded).toBe(true);
  expect(s.imgSrc).toMatch(/\/images\/hero\/hero-(landscape|portrait)-/); // the pre-optimised static files, not an on-demand variant
  expect(s.h1Visible).toBe(true);
  expect(s.h1Opacity).toBe(1);
  expect(problems).toEqual([]);
});

test("the correct hero file is preloaded in the document head", async ({ page }) => {
  await page.goto("/");
  const preloads = await page.locator("head link[rel='preload'][as='image']").evaluateAll((els) => els.map((e) => ({ media: e.getAttribute("media"), href: e.getAttribute("href") ?? e.getAttribute("imagesrcset") })));
  expect(preloads.length).toBeGreaterThanOrEqual(2);
  expect(preloads.some((p) => /hero-portrait/.test(p.href ?? "") && /max-width/.test(p.media ?? ""))).toBe(true);
  expect(preloads.some((p) => /hero-landscape/.test(p.href ?? "") && /min-width/.test(p.media ?? ""))).toBe(true);
});

test("hero is correct after a reload, and after navigating away and back", async ({ page }) => {
  await page.goto("/");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(900);
  expect((await heroState(page)).imgLoaded).toBe(true);
  await page.goto("/faq");
  await page.goBack({ waitUntil: "load" });
  await page.waitForTimeout(900);
  const s = await heroState(page);
  expect(s.imgLoaded).toBe(true);
  expect(s.h1Opacity).toBe(1);
});

test("the hero does not shift the layout while it loads", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.05);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the hero still shows its photograph and words (nothing waits for hydration)", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    expect(await h1.evaluate((el) => Number(getComputedStyle(el.closest(".hero-rise") ?? el).opacity))).toBe(1);
    expect(await page.locator("section img[fetchpriority='high']").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  });
});
