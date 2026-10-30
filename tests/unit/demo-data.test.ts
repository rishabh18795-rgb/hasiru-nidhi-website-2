import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { demoCatalog, demoPricing, demoProperties, demoToSearchResult, demoUnavailable, searchDemo } from "@/lib/demo/properties";
import { AMENITY_NAMES, CATEGORY_NAMES, EXPERIENCE_NAMES } from "@/lib/demo/vocabulary";
import { parseStayFilters } from "@/lib/stays/filters";
import { quoteStay } from "@/lib/pricing";
import { authHrefForBooking, selectionQuery, stayHref } from "@/lib/stays/booking-links";

const ROOT = path.resolve(__dirname, "../..");
const NAMES = ["Green Valley Farm Stay", "Countryside Garden Cottage", "Forest Edge Eco Retreat", "Riverside Nature Escape", "Organic Farm Experience", "Weekend Cycling Retreat"];
const TODAY = "2026-11-01";
const f = (raw: Record<string, string> = {}) => parseStayFilters(raw, new Date("2026-11-01T06:00:00Z"));
const slugs = (raw: Record<string, string>) => searchDemo(f(raw), TODAY).results.map((r) => r.slug);

describe("built-in demo dataset", () => {
  it("is the six requested listings, all fictional and complete", () => {
    expect(demoProperties.map((d) => d.name)).toEqual(NAMES);
    for (const d of demoProperties) {
      expect(d.description, d.slug).toMatch(/DEMONSTRATION LISTING — SAMPLE DATA/);
      expect(d.summary, d.slug).toMatch(/^Demo listing:/);
      expect(d.region, d.slug).toMatch(/demo location/);
      expect(d.house_rules, d.slug).toMatch(/^Demo house rules:/);
      for (const k of ["price_inr", "max_guests", "bedrooms", "bathrooms", "beds", "min_nights", "max_nights"] as const) expect(d[k], `${d.slug}.${k}`).toBeGreaterThan(0);
      expect(d.check_in).toMatch(/^\d{2}:\d{2}$/);
      expect(d.check_out).toMatch(/^\d{2}:\d{2}$/);
      expect(d.amenities.length, d.slug).toBeGreaterThanOrEqual(5);
      expect(d.images.length, d.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses only photographs that ship with the project (no remote URLs that could break)", () => {
    for (const d of demoProperties) for (const img of d.images) {
      expect(img.path.startsWith("/images/"), img.path).toBe(true);
      expect(fs.existsSync(path.join(ROOT, "public", img.path)), img.path).toBe(true);
      expect(img.alt).toMatch(/illustrative/i);
    }
  });

  it("every category, amenity and experience slug exists in the database vocabulary", () => {
    const sql = fs.readdirSync(path.join(ROOT, "supabase/migrations")).map((f) => fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8")).join("\n");
    const known = (slug: string) => sql.includes(`'${slug}'`);
    for (const d of demoProperties) {
      expect(known(d.category), d.category).toBe(true);
      for (const a of d.amenities) { expect(known(a), a).toBe(true); expect(AMENITY_NAMES[a], a).toBeTruthy(); }
      for (const e of d.experiences) { expect(known(e), e).toBe(true); expect(EXPERIENCE_NAMES[e], e).toBeTruthy(); }
      expect(CATEGORY_NAMES[d.category]).toBeTruthy();
    }
  });

  it("every card is marked as sample data", () => {
    for (const d of demoProperties) expect(demoToSearchResult(d).is_sample).toBe(true);
  });
});

describe("demo search mirrors the database search", () => {
  it("returns all six by default, featured first", () => {
    const r = searchDemo(f(), TODAY);
    expect(r.total).toBe(6);
    expect(r.results[0].slug).toBe("demo-green-valley-farm-stay");
  });
  it("filters by location text, property type, guests and price range", () => {
    expect(slugs({ q: "ramanagara" })).toEqual(["demo-green-valley-farm-stay"]);
    expect(slugs({ q: "nandi" })).toEqual(["demo-weekend-cycling-retreat"]);
    expect(slugs({ category: "cottage" })).toEqual(["demo-countryside-garden-cottage"]);
    expect(slugs({ guests: "10" })).toEqual(["demo-weekend-cycling-retreat"]);
    expect(slugs({ min: "5000", max: "7000" }).sort()).toEqual(["demo-countryside-garden-cottage", "demo-riverside-nature-escape"]);
    expect(slugs({ q: "nowhere-at-all" })).toEqual([]);
  });
  it("filters by amenities (all) and experiences (any)", () => {
    expect(slugs({ amenities: "bonfire,garden" })).toEqual(["demo-countryside-garden-cottage"]);
    expect(slugs({ amenities: "bicycles" })).toEqual(["demo-weekend-cycling-retreat"]);
    expect(slugs({ experiences: "stargazing,village-walk" }).length).toBe(4);
  });
  it("sorts by price", () => {
    expect(slugs({ sort: "price_asc" })[0]).toBe("demo-organic-farm-experience");
    expect(slugs({ sort: "price_desc" })[0]).toBe("demo-weekend-cycling-retreat");
  });
  it("hides listings whose dates are blocked", () => {
    const green = demoProperties.find((d) => d.slug === "demo-green-valley-farm-stay")!;
    const [blocked] = demoUnavailable(green, TODAY);
    const inside = slugs({ checkin: blocked.start_date, checkout: blocked.end_date });
    expect(inside).not.toContain("demo-green-valley-farm-stay");
    expect(inside.length).toBe(5);
    expect(slugs({ checkin: "2027-03-01", checkout: "2027-03-03" }).length).toBe(6);
  });
  it("offers a catalogue for the filter form built from the demo data only", () => {
    const c = demoCatalog();
    expect(c.categories.map((x) => x.slug).sort()).toEqual(["cottage", "cycling-friendly", "eco-retreat", "farm-stay", "nature-retreat"]);
    expect(c.amenities.length).toBeGreaterThan(8);
  });
});

describe("illustrative totals", () => {
  const rules = (slug: string) => demoPricing(demoProperties.find((d) => d.slug === slug)!);
  it("flat nightly rate x nights", () => {
    expect(quoteStay(rules("demo-countryside-garden-cottage"), "2030-01-07", "2030-01-09", 2)).toMatchObject({ nights: 2, total: 10400 }); // Mon, Tue
  });
  it("weekend nights use the weekend rate", () => {
    expect(quoteStay(rules("demo-countryside-garden-cottage"), "2030-01-11", "2030-01-13", 2)).toMatchObject({ weekend_nights: 2, total: 12400 }); // Fri, Sat
  });
  it("per-guest pricing multiplies by guests", () => {
    expect(quoteStay(rules("demo-organic-farm-experience"), "2030-01-07", "2030-01-09", 3)?.total).toBe(9600);
  });
  it("only charges extra guests and cleaning fees the listing actually defines", () => {
    expect(quoteStay(rules("demo-green-valley-farm-stay"), "2030-01-07", "2030-01-08", 5)).toMatchObject({ extra_guests: 600, cleaning: 0, tax: 0, total: 4800 });
    expect(quoteStay(rules("demo-forest-edge-eco-retreat"), "2030-01-07", "2030-01-09", 2)).toMatchObject({ cleaning: 800, total: 15800 });
    expect(quoteStay(rules("demo-riverside-nature-escape"), "2030-01-07", "2030-01-09", 2)?.tax).toBe(0);
  });
});

describe("booking selection survives sign-in", () => {
  const sel = { checkin: "2026-12-05", checkout: "2026-12-08", guests: 4 };
  it("builds property links that keep dates and guests", () => {
    expect(selectionQuery(sel)).toBe("?checkin=2026-12-05&checkout=2026-12-08&guests=4");
    expect(stayHref("demo-x", sel)).toBe("/stays/demo-x?checkin=2026-12-05&checkout=2026-12-08&guests=4#booking");
    expect(stayHref("demo-x", sel, "/demo/stays")).toMatch(/^\/demo\/stays\/demo-x\?/);
  });
  it("sign-in and sign-up links return to the same property with the same choices", () => {
    for (const kind of ["sign-in", "sign-up"] as const) {
      const href = authHrefForBooking(kind, "demo-x", sel);
      expect(href.startsWith(`/${kind}?next=`)).toBe(true);
      const next = decodeURIComponent(href.split("next=")[1]);
      expect(next).toBe("/stays/demo-x?checkin=2026-12-05&checkout=2026-12-08&guests=4#booking");
    }
  });
  it("drops invalid selections instead of carrying junk", () => {
    expect(selectionQuery({ checkin: "2026-12-08", checkout: "2026-12-05", guests: 0 })).toBe("");
    expect(selectionQuery({ checkin: "<script>", checkout: "x", guests: 9999 })).toBe("");
    expect(selectionQuery({})).toBe("");
    expect(authHrefForBooking("sign-in", "demo-x", {})).toBe("/sign-in?next=%2Fstays%2Fdemo-x%23booking");
  });
});
