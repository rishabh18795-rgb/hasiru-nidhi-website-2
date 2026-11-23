import { describe, expect, it } from "vitest";

import { parseServiceFilters, serviceFiltersToQuery, activeServiceFilterCount } from "../../src/lib/services/filters";
import { durationText, istLocalToIso, servicePriceText, REQUEST_STATUS_LABEL } from "../../src/lib/services";
import { parseAvailability, quotationSchema, serviceRequestSchema, serviceSchema, timeOffSchema } from "../../src/lib/validation/service";
import { friendlyDbError } from "../../src/lib/action";

const ID = "11111111-1111-4111-8111-111111111111";

describe("service listing validation", () => {
  const base = { name: "Lawn care visit", category_id: "1", summary: "", description: "", pricing_model: "fixed", price_inr: "500", price_unit: "visit", duration_minutes: "60", specifications: "" };
  it("accepts a fixed-price listing and a quotation listing", () => {
    expect(serviceSchema.safeParse(base).success).toBe(true);
    expect(serviceSchema.safeParse({ ...base, pricing_model: "quote", price_inr: "", price_unit: "" }).success).toBe(true);
  });
  it("a fixed price needs a price and a unit", () => {
    const r = serviceSchema.safeParse({ ...base, price_inr: "", price_unit: "" });
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["price_inr", "price_unit"]));
  });
  it("limits the visit length to 15 minutes to 8 hours", () => {
    expect(serviceSchema.safeParse({ ...base, duration_minutes: "10" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, duration_minutes: "481" }).success).toBe(false);
  });
});

describe("service request validation", () => {
  const ok = { service_id: ID, key: "sr-12345678", quantity: "2", customer_name: "Alice", phone: "98765 43210", address_line: "12 Rose Street", city: "Bengaluru", pin: "560078", property_type: "", site_size: "", details: "", preferred: "" };
  it("accepts a complete request and defaults the quantity", () => {
    expect(serviceRequestSchema.parse(ok).quantity).toBe(2);
    expect(serviceRequestSchema.parse({ ...ok, quantity: "" }).quantity).toBe(1);
  });
  it("needs a 6-digit PIN, a reachable phone and an address", () => {
    const r = serviceRequestSchema.safeParse({ ...ok, pin: "5600", phone: "1", address_line: "" });
    expect(r.success ? [] : r.error.issues.map((i) => i.path[0]).sort()).toEqual(["address_line", "phone", "pin"]);
  });
});

describe("quotation and time-off validation", () => {
  it("quotation needs an amount, a description and an expiry", () => {
    expect(quotationSchema.safeParse({ request_id: ID, amount_inr: "9500.50", description: "Design and planting, two visits.", valid_until: "2026-12-31" }).success).toBe(true);
    expect(quotationSchema.safeParse({ request_id: ID, amount_inr: "0", description: "short", valid_until: "" }).success).toBe(false);
  });
  it("time off needs both dates", () => {
    expect(timeOffSchema.safeParse({ starts_on: "2026-12-01", ends_on: "2026-12-03" }).success).toBe(true);
    expect(timeOffSchema.safeParse({ starts_on: "", ends_on: "" }).success).toBe(false);
  });
});

describe("weekly hours parsing", () => {
  it("reads the days that are filled and skips blank ones", () => {
    const r = parseAvailability({ start_1: "09:00", end_1: "17:00", start_2: "", end_2: "" });
    expect(r.errors).toEqual([]);
    expect(r.rules).toEqual([{ weekday: 1, start: "09:00", end: "17:00" }]);
  });
  it("rejects an end before the start and a half-filled day", () => {
    expect(parseAvailability({ start_1: "17:00", end_1: "09:00" }).errors).toHaveLength(1);
    expect(parseAvailability({ start_3: "09:00", end_3: "" }).errors).toHaveLength(1);
  });
});

describe("service filters and display", () => {
  it("sanitises URL parameters", () => {
    const f = parseServiceFilters({ q: "  lawn  ", pin: "56007", pricing: "free", vendor: "../x", sort: "nope", page: "-3" });
    expect(f).toMatchObject({ q: "lawn", pin: "", pricing: "", vendor: "", sort: "newest", page: 1 });
    expect(parseServiceFilters({ pin: "560078", pricing: "fixed", category: "gardening" })).toMatchObject({ pin: "560078", pricing: "fixed", category: "gardening" });
  });
  it("round-trips filters into a query string and counts active ones", () => {
    const f = parseServiceFilters({ pin: "560078", pricing: "quote", sort: "price_asc", page: "2" });
    expect(serviceFiltersToQuery(f)).toBe("?pin=560078&pricing=quote&sort=price_asc&page=2");
    expect(activeServiceFilterCount(f)).toBe(2);
  });
  it("shows the provider's price or 'Quotation on request', never an invented figure", () => {
    expect(servicePriceText("fixed", "500", "visit")).toBe("₹500 per visit");
    expect(servicePriceText("fixed", 1499.5, "hour")).toBe("₹1,499.50 per hour");
    expect(servicePriceText("quote", null, null)).toBe("Quotation on request");
  });
  it("formats durations and India-time inputs", () => {
    expect(durationText(45)).toBe("45 min");
    expect(durationText(120)).toBe("2 h");
    expect(durationText(90)).toBe("1 h 30 min");
    expect(istLocalToIso("2026-12-01T10:30")).toBe("2026-12-01T10:30:00+05:30");
    expect(istLocalToIso("garbage")).toBeNull();
  });
  it("labels every request status", () => {
    expect(Object.keys(REQUEST_STATUS_LABEL).sort()).toEqual(["accepted", "cancelled", "completed", "declined", "in_progress", "quoted", "submitted"]);
  });
});

describe("friendly service errors", () => {
  it.each([
    ["slot_unavailable", /not available/i], ["outside_service_area", /does not serve/i], ["quotation_expired", /expired/i], ["quotation_required", /quotation/i],
    ["services_closed", /not open/i], ["incomplete_service: images,service_areas", /photo.*PIN/i],
  ])("%s", (raw, expected) => expect(friendlyDbError({ message: raw })).toMatch(expected));
});
