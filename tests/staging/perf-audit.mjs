// Lab performance measurement of key pages on the production build (STAGING data), mobile profile: Pixel 7, 4x CPU slowdown, ~1.6 Mbps / 150 ms network.
// Reports LCP, CLS and total transferred JS/image weight. These are LAB numbers from one machine, not real-user (field) data.
import { chromium, devices } from "@playwright/test";
import { loadEnv, clients } from "./lib.mjs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3401";
const c = clients(loadEnv());
const prod = (await c.anon.rpc("search_products", { p_limit: 1 })).data[0];
const svc = (await c.anon.rpc("search_services", { p_limit: 1 })).data[0];
const PAGES = ["/", "/stays", "/stays/staging-cottage-demo", "/shop", `/shop/p/${prod.slug}`, "/services", `/services/${svc.slug}`, "/gardening", "/sign-in"];
const b = await chromium.launch({ channel: "chrome" });
const rows = [];
for (const profile of ["mobile", "desktop"]) {
  for (const path of PAGES) {
    const ctx = await b.newContext(profile === "mobile" ? { ...devices["Pixel 7"] } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    if (profile === "mobile") { await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
    let js = 0, img = 0; p.on("response", async (r) => { const len = Number(r.headers()["content-length"] ?? 0); const t = r.headers()["content-type"] ?? ""; if (t.includes("javascript")) js += len; else if (t.startsWith("image/")) img += len; });
    await p.addInitScript(() => { window.__m = { lcp: 0, cls: 0 }; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
    await p.goto(BASE + path, { waitUntil: "load" }); await p.waitForTimeout(2500); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(800);
    const m = await p.evaluate(() => window.__m);
    rows.push({ profile, path: path.length > 34 ? path.slice(0, 31) + "…" : path, LCP: (m.lcp / 1000).toFixed(2) + "s", CLS: m.cls.toFixed(3), JS_KB: Math.round(js / 1024), IMG_KB: Math.round(img / 1024) });
    await ctx.close();
  }
}
await b.close();
console.table(rows);
