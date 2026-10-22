import type { Page, Response } from "@playwright/test";

/**
 * Navigates and waits for the document to be usable. The tests assert on content, not on the browser's `load` event,
 * so a slow third-party-style subresource can't fail them. If `load` is still pending after 15 s, the stalled requests
 * are reported as a CI warning (never silently ignored) so a real hang is visible.
 */
export async function visit(page: Page, path: string): Promise<Response | null> {
  const pending = new Map<string, string>();
  const onRequest = (r: { url(): string; resourceType(): string }) => pending.set(r.url(), r.resourceType());
  const onDone = (r: { url(): string }) => pending.delete(r.url());
  page.on("request", onRequest);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {
    const stalled = [...pending].map(([u, t]) => `${t}:${u.slice(0, 120)}`).join(" | ");
    console.log(`::warning title=load event still pending::${path} -> ${stalled || "no outstanding requests"}`);
  });
  page.off("request", onRequest);
  page.off("requestfinished", onDone);
  page.off("requestfailed", onDone);
  return res;
}
