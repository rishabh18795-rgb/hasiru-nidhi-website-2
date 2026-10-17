import { describe, expect, it } from "vitest";

import { parseStayFilters, stayFiltersToQuery, activeFilterCount } from "@/lib/stays/filters";

const NOW = new Date("2026-10-17T06:00:00Z"); // 11:30 IST, 17 Oct 2026

describe("parseStayFilters", () => {
  it("returns safe defaults for empty input", () => {
    const f = parseStayFilters({}, NOW);
    expect(f).toMatchObject({ q: "", category: "", min: null, max: null, guests: null, amenities: [], experiences: [], checkin: "", checkout: "", sort: "featured", page: 1 });
  });

  it("round-trips through the query string", () => {
    const f = parseStayFilters({ q: "Coorg", category: "cottage", min: "1000", max: "9000", guests: "4", amenities: "wifi,parking", experiences: "cycling-trails", checkin: "2026-11-01", checkout: "2026-11-04", sort: "price_asc", page: "2" }, NOW);
    const qs = stayFiltersToQuery(f);
    const back = parseStayFilters(Object.fromEntries(new URLSearchParams(qs)), NOW);
    expect(back).toEqual(f);
  });

  it("drops dates in the past and a check-out that is not after check-in", () => {
    expect(parseStayFilters({ checkin: "2026-10-01", checkout: "2026-10-05" }, NOW)).toMatchObject({ checkin: "", checkout: "" });
    expect(parseStayFilters({ checkin: "2026-11-05", checkout: "2026-11-05" }, NOW)).toMatchObject({ checkin: "2026-11-05", checkout: "" });
    expect(parseStayFilters({ checkin: "2026-11-05", checkout: "2026-11-01" }, NOW)).toMatchObject({ checkout: "" });
  });

  it("accepts today (IST) as a check-in date", () => {
    expect(parseStayFilters({ checkin: "2026-10-17", checkout: "2026-10-18" }, NOW)).toMatchObject({ checkin: "2026-10-17", checkout: "2026-10-18" });
  });

  it("ignores garbage numbers, unknown sorts and malformed slugs (injection-safe)", () => {
    const f = parseStayFilters({ min: "-5", max: "abc", guests: "99999", sort: "DROP TABLE", category: "a; drop table", amenities: "ok,../etc,<script>", page: "-3" }, NOW);
    expect(f).toMatchObject({ min: null, max: null, guests: null, sort: "featured", category: "", page: 1 });
    expect(f.amenities).toEqual(["ok"]);
  });

  it("de-duplicates repeated amenity params and lower-cases them", () => {
    const f = parseStayFilters({ amenities: ["WiFi", "wifi", "parking"] }, NOW);
    expect(f.amenities).toEqual(["wifi", "parking"]);
  });

  it("caps long free-text queries", () => {
    expect(parseStayFilters({ q: "x".repeat(500) }, NOW).q).toHaveLength(100);
  });

  it("counts only active non-text filters", () => {
    expect(activeFilterCount(parseStayFilters({ q: "hello" }, NOW))).toBe(0);
    expect(activeFilterCount(parseStayFilters({ category: "cottage", guests: "2", amenities: "wifi" }, NOW))).toBe(3);
  });
});
