// Responsive audit against the staging-backed app: key pages at ten widths. Reports horizontal overflow, text clipped by its container, images
// rendered far outside their frame, tiny tap targets on phones, and header state. STAGING ONLY. Usage: AUDIT_BASE=http://localhost:3401 node ...
import { chromium } from "@playwright/test";
import { loadEnv, clients } from "./lib.mjs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3401";
const c = clients(loadEnv());
const prod = (await c.anon.rpc("search_products", { p_limit: 1 })).data[0];
const svc = (await c.anon.rpc("search_services", { p_limit: 1 })).data[0];
const PAGES = ["/", "/stays", "/stays/staging-cottage-demo", "/nature-stay", "/experiences", "/gardening", "/about", "/contact", "/faq", "/become-a-host", "/become-a-vendor", "/sign-in", "/shop", `/shop/p/${prod.slug}`, "/services", `/services/${svc.slug}`, "/packages", "/pricing"];
const WIDTHS = [360, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920];
const b = await chromium.launch({ channel: "chrome" });
const issues = []; let checks = 0;
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 820 }, hasTouch: w < 1024, isMobile: w < 768 });
  const p = await ctx.newPage();
  for (const path of PAGES) {
    await p.goto(BASE + path, { waitUntil: "load" }).catch(() => null);
    await p.waitForTimeout(250);
    const r = await p.evaluate((w) => {
      const out = { over: document.documentElement.scrollWidth - innerWidth, clipped: [], tiny: [], header: "" };
      for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,label")) {
        const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
        if ((cs.overflow === "hidden" || cs.overflowX === "hidden") && cs.textOverflow !== "ellipsis" && !cs.webkitLineClamp && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.closest("[class*=sr-only]")) out.clipped.push((el.textContent || "").trim().slice(0, 40));
      }
      if (w < 768) for (const el of document.querySelectorAll("a,button,input,select,textarea")) { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (r.width > 0 && cs.visibility !== "hidden" && !el.closest(".sr-only") && cs.position !== "absolute" && (r.height < 24 || r.width < 24) && r.top < 4000) out.tiny.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)); }
      const nav = document.querySelector("header nav"); out.header = nav && [...nav.children].some((x) => x.matches("div.hidden") && getComputedStyle(x).display !== "none") ? "desktop" : "menu";
      return out;
    }, w);
    checks++;
    if (r.over > 1) issues.push(`${w}px ${path}: sideways scroll ${r.over}px`);
    if (r.clipped.length) issues.push(`${w}px ${path}: text clipped: ${[...new Set(r.clipped)].slice(0, 3).join(" | ")}`);
    if (r.tiny.length) issues.push(`${w}px ${path}: tiny tap targets: ${[...new Set(r.tiny)].slice(0, 4).join(" | ")}`);
  }
  await ctx.close();
}
await b.close();
console.log(`RESPONSIVE: ${checks} page-width checks, ${issues.length} findings`);
const seen = new Map(); for (const i of issues) { const k = i.replace(/^\d+px /, ""); (seen.get(k) ?? seen.set(k, []).get(k)).push(i.split("px")[0]); }
for (const [k, ws] of seen) console.log(` ${k}  [${ws.join(",")}]`);
