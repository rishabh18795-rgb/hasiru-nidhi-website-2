import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { blogPosts, experiences, packages, stayCategories } from "../../src/lib/content";
import { footerLinks, navLinks } from "../../src/lib/site";

const SRC = path.resolve(__dirname, "../../src");
const read = (f: string) => fs.readFileSync(path.join(SRC, f), "utf8");

const PAGES = ["nature-stay", "cycling", "experiences", "packages", "pricing", "gallery", "blog"].map((p) => `app/${p}/page.tsx`);
const COPY = [...PAGES, "app/blog/[slug]/page.tsx", "lib/content.ts"];

describe("the seven public pages make no claims the business has not confirmed", () => {
  const text = COPY.map(read).join("\n");

  it.each([
    [/₹\s?\d/, "a rupee price"],
    [/\bINR\s?\d/i, "an INR price"],
    [/\b\d+\s?%\s?(off|discount)/i, "a discount"],
    [/\b(five-star|5-star|rated|award-winning|certified)\b/i, "ratings, awards or certifications"],
    [/\b\d+\s?(km|kilometres)\s?(loop|route|trail)/i, "an invented cycling route"],
    [/\bbicycles? (are )?(provided|included)\b/i, "a guaranteed bicycle offer"],
    [/\b(most[- ]booked|bestseller|best[- ]seller|sold out|only \d+ left)\b/i, "invented popularity or scarcity"],
    [/\b(secure|instant) (payment|booking)\b/i, "a payment or instant-booking capability"],
    [/\bcleaning fee of|service charge of|convenience fee\b/i, "an invented charge"],
  ])("contains no %s", (pattern) => {
    expect(text).not.toMatch(pattern);
  });

  it("says plainly that online payment is not available on the pricing page", () => {
    expect(read("app/pricing/page.tsx")).toMatch(/Online payment is not set up/);
  });

  it("presents packages as enquiries, with no price, duration or inclusion data", () => {
    for (const p of packages) {
      expect(Object.keys(p).sort()).toEqual(["bestFor", "description", "image", "name", "slug", ...(p.featured ? ["featured"] : [])].sort());
    }
    expect(read("app/packages/page.tsx")).toMatch(/confirmed by our team when you enquire/);
    expect(read("app/packages/page.tsx")).not.toMatch(/href="\/book\?experience=/);
  });
});

describe("content stays inside the platform's real vocabulary", () => {
  it("has 8 experiences and 6 stay categories that all link to real destinations", () => {
    expect(experiences).toHaveLength(8);
    expect(stayCategories).toHaveLength(6);
    for (const e of experiences) expect(e.href).toMatch(/^\/(cycling|stays\?experiences=[a-z-]+)$/);
    for (const c of stayCategories) expect(c.slug).toMatch(/^[a-z-]+$/);
  });
  it("has unique journal slugs and meaningful, non-duplicate article bodies", () => {
    expect(new Set(blogPosts.map((p) => p.slug)).size).toBe(blogPosts.length);
    const paragraphs = blogPosts.flatMap((p) => p.content);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
    for (const p of blogPosts) {
      expect(p.excerpt.length).toBeGreaterThan(40);
      expect(p.content.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("page metadata", () => {
  it.each(PAGES)("%s has a unique title and a description of at most 160 characters", (file) => {
    const src = read(file);
    const title = /title:\s*"([^"]+)"/.exec(src)?.[1];
    const desc = /description:\s*"([^"]+)"/.exec(src)?.[1];
    expect(title, "title").toBeTruthy();
    expect(desc, "description").toBeTruthy();
    expect(desc!.length).toBeLessThanOrEqual(160);
    expect(desc!.length).toBeGreaterThanOrEqual(70);
  });
  it("titles are all different", () => {
    const titles = PAGES.map((f) => /title:\s*"([^"]+)"/.exec(read(f))?.[1]);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("navigation", () => {
  const hrefs = [
    ...navLinks.flatMap((l) => [l.href, ...("children" in l ? l.children.map((c) => c.href) : [])]),
    ...footerLinks.explore.map((l) => l.href),
    ...footerLinks.plan.map((l) => l.href),
  ];
  it("reaches every public section", () => {
    for (const h of ["/stays", "/nature-stay", "/experiences", "/cycling", "/packages", "/pricing", "/gallery", "/blog", "/gardening-landscaping", "/become-a-host", "/about", "/contact"]) {
      expect(hrefs, h).toContain(h);
    }
  });
  it("only links to pages that exist", () => {
    for (const h of new Set(hrefs)) {
      const route = h.split(/[?#]/)[0];
      const dir = route === "/" ? "app" : `app${route}`;
      const exists = ["page.tsx", "page.ts"].some((f) => fs.existsSync(path.join(SRC, dir, f))) || fs.existsSync(path.join(SRC, "app/(portal)", route, "page.tsx"));
      expect(exists, `${h} has no page`).toBe(true);
    }
  });
});
