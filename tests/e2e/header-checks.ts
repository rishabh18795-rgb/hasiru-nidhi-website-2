import { expect, type Page } from "@playwright/test";

/** Shared header checks. The no-backend suite shows 6 links (Shop and Services appear only when those modules are ON); the staging suite shows all 8. */
export const DESKTOP_WIDTHS = [1366, 1440, 1536, 1920];
export const MENU_WIDTHS = [360, 390, 768, 1024, 1280];

export async function checkDesktopHeader(page: Page, width: number, expectedLinks: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const m = await page.evaluate(() => {
    const nav = document.querySelector("header nav")!;
    const nr = nav.getBoundingClientRect();
    const cy = nr.top + nr.height / 2;
    const hidden = [...nav.children].filter((c) => c.matches("div.hidden"));
    const links = [...hidden[0].querySelectorAll(":scope > div > a")] as HTMLElement[];
    const right = hidden[1] as HTMLElement;
    const logo = nav.querySelector('a[aria-label="Hasiru Nidhi home"]') as HTMLElement;
    const rects = [...links, ...(Array.from(right.children) as HTMLElement[]), logo].map((e) => e.getBoundingClientRect());
    return {
      count: links.length,
      wrapped: links.filter((a) => a.getBoundingClientRect().height > 44).map((a) => a.textContent?.trim()),
      offCentre: Math.max(...rects.map((r) => Math.abs(r.top + r.height / 2 - cy))),
      logoGap: links[0].getBoundingClientRect().left - logo.getBoundingClientRect().right,
      rightGap: right.getBoundingClientRect().left - links[links.length - 1].getBoundingClientRect().right,
      // logo is the leftmost item, the button the rightmost, and the two outer margins match (the header is centred in its container)
      logoOnLeft: logo.getBoundingClientRect().left <= links[0].getBoundingClientRect().left,
      buttonOnRight: right.getBoundingClientRect().right >= links[links.length - 1].getBoundingClientRect().right,
      marginSkew: Math.abs(logo.getBoundingClientRect().left - (innerWidth - right.getBoundingClientRect().right)),
      sideways: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(m.count).toBe(expectedLinks);
  expect(m.wrapped).toEqual([]);
  expect(m.offCentre).toBeLessThan(2);
  expect(m.logoGap).toBeGreaterThanOrEqual(16);
  expect(m.rightGap).toBeGreaterThanOrEqual(16);
  expect(m.logoOnLeft && m.buttonOnRight).toBe(true);
  expect(m.marginSkew).toBeLessThan(4);
  expect(m.sideways).toBeLessThanOrEqual(1);
  await expect(page.getByRole("link", { name: /^Gardening Services/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "List Your Property" }).first()).toBeVisible();
}

export async function checkMenuHeader(page: Page, width: number, labels: string[]) {
  await page.setViewportSize({ width, height: 700 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  const dlg = page.getByRole("dialog");
  for (const label of labels) {
    const link = dlg.getByRole("link", { name: label, exact: true }).first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}
