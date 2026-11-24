// SEO audit of the staging-backed app: per page title, description, canonical, Open Graph, heading, structured data and robots meta, plus robots.txt and sitemap.xml.
import { loadEnv, clients } from "./lib.mjs";
import { parse } from "node:path";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3401";
const c = clients(loadEnv());
const prod = (await c.anon.rpc("search_products", { p_limit: 1 })).data[0];
const svc = (await c.anon.rpc("search_services", { p_limit: 1 })).data[0];
const PAGES = ["/", "/stays", "/stays/staging-cottage-demo", "/nature-stay", "/experiences", "/gardening", "/about", "/contact", "/faq", "/become-a-host", "/become-a-vendor", "/shop", `/shop/p/${prod.slug}`, "/services", `/services/${svc.slug}`, "/packages", "/pricing", "/blog", "/privacy", "/terms", "/cancellation-policy", "/sign-in", "/cart"];
const tag = (h, re) => (h.match(re) ?? [])[1];
const rows = []; const problems = [];
for (const path of PAGES) {
  const h = await (await fetch(BASE + path, { redirect: "manual" })).text();
  const title = tag(h, /<title[^>]*>([^<]*)<\/title>/i) ?? "", desc = tag(h, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ?? tag(h, /<meta[^>]+content="([^"]*)"[^>]+name="description"/i) ?? "";
  const canon = tag(h, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) ?? "", ogt = /property="og:title"/.test(h), ogi = /property="og:image"/.test(h), noindex = /name="robots"[^>]+noindex/i.test(h);
  const h1 = (h.match(/<h1[\s>]/g) ?? []).length; let ld = 0, ldBad = 0; for (const m of h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { ld++; try { JSON.parse(m[1]); } catch { ldBad++; } }
  const imgNoAlt = (h.match(/<img(?![^>]*\balt=)[^>]*>/g) ?? []).length;
  rows.push({ path: path.length > 30 ? path.slice(0, 27) + "…" : path, title: title.length, desc: desc.length, canon: canon ? "yes" : "NO", og: ogt && ogi ? "yes" : ogt ? "no-img" : "NO", h1, ld: ld + (ldBad ? " BAD" : ""), noindex: noindex ? "yes" : "", imgNoAlt });
  const priv = ["/sign-in", "/cart"].includes(path);
  if (!title || title.length > 70) problems.push(`${path}: title length ${title.length}`);
  if (!priv && (desc.length < 50 || desc.length > 170)) problems.push(`${path}: description length ${desc.length}`);
  if (!priv && !canon) problems.push(`${path}: no canonical`);
  if (h1 !== 1) problems.push(`${path}: ${h1} h1`);
  if (imgNoAlt) problems.push(`${path}: ${imgNoAlt} images without alt`);
}
console.table(rows);
const robots = await (await fetch(BASE + "/robots.txt")).text(); const sm = await (await fetch(BASE + "/sitemap.xml")).text();
console.log("robots.txt disallows:", [...robots.matchAll(/Disallow: (.*)/g)].map((m) => m[1]).join(" "));
const urls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => parse(new URL(m[1]).pathname).dir + "/" + parse(new URL(m[1]).pathname).base);
console.log("sitemap URLs:", urls.length, "| includes /shop:", sm.includes("/shop"), "| includes /services:", sm.includes("/services"), "| host in sitemap:", (sm.match(/<loc>https?:\/\/[^/<]+/) ?? [])[0]);
console.log("PROBLEMS:", problems.length ? "\n  " + problems.join("\n  ") : "none");
