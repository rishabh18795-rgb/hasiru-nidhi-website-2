import { describe, expect, it } from "vitest";

import { collectStepValues, crossChecks, parseStep, publicCoordinate } from "@/lib/wizard/schemas";
import { WIZARD_STEPS, nextStep, previousStep, isStepKey } from "@/lib/wizard/steps";

const strict = (step: Parameters<typeof parseStep>[0], input: Record<string, unknown>) => parseStep(step, input, true);
const lenient = (step: Parameters<typeof parseStep>[0], input: Record<string, unknown>) => parseStep(step, input, false);

describe("wizard step order", () => {
  it("has the eight steps in order and navigates between them", () => {
    expect(WIZARD_STEPS.map((s) => s.key)).toEqual(["type", "location", "details", "photos", "amenities", "pricing", "availability", "review"]);
    expect(nextStep("type")).toBe("location");
    expect(previousStep("type")).toBeNull();
    expect(nextStep("review")).toBeNull();
    expect(isStepKey("pricing")).toBe(true);
    expect(isStepKey("../admin")).toBe(false);
  });
});

describe("strict (Continue) vs lenient (Save draft)", () => {
  it("Continue demands every required field with a message per field", () => {
    const r = strict("location", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["address_line", "city", "country", "location_precision", "postal_code", "state"]);
  });

  it("Save draft accepts blanks but still rejects malformed values", () => {
    expect(lenient("location", { city: "Mysuru", state: "", postal_code: "" }).ok).toBe(true);
    const bad = lenient("pricing", { price_inr: "abc" });
    expect(bad.ok).toBe(false);
    const tooHigh = lenient("pricing", { tax_percent: "55" });
    expect(tooHigh.ok).toBe(false);
  });

  it("converts numbers and trims text", () => {
    const r = strict("type", { name: "  Coorg Coffee Cottage ", category_id: "3" });
    expect(r).toEqual({ ok: true, data: { name: "Coorg Coffee Cottage", category_id: 3 } });
  });
});

describe("details step", () => {
  const valid = { description: "x".repeat(60), rooms_count: "3", max_guests: "6", bedrooms: "3", beds: "4", bathrooms: "2.5", accommodation_arrangement: "entire_property", check_in_time: "14:00", check_out_time: "11:00" };
  it("accepts a complete step", () => expect(strict("details", valid).ok).toBe(true));
  it.each([
    ["short description", { description: "too short" }],
    ["fractional beds", { beds: "2.5" }],
    ["bathrooms not in halves", { bathrooms: "1.3" }],
    ["unknown arrangement", { accommodation_arrangement: "castle" }],
    ["bad time", { check_in_time: "2pm" }],
    ["zero guests", { max_guests: "0" }],
  ])("rejects %s", (_n, patch) => expect(strict("details", { ...valid, ...patch }).ok).toBe(false));
});

describe("location cross-checks", () => {
  it("requires both coordinates or neither", () => {
    expect(crossChecks("location", { latitude: 12.3 }, true).longitude).toBeDefined();
    expect(crossChecks("location", { longitude: 76.1 }, true).latitude).toBeDefined();
    expect(crossChecks("location", { latitude: 12.3, longitude: 76.1 }, true)).toEqual({});
  });
  it("checks Indian PIN codes", () => {
    expect(crossChecks("location", { country: "India", postal_code: "5600" }, true).postal_code).toBeDefined();
    expect(crossChecks("location", { country: "India", postal_code: "560001" }, true)).toEqual({});
    expect(crossChecks("location", { country: "Sri Lanka", postal_code: "10100" }, true)).toEqual({});
  });
  it("an exact pin needs coordinates", () => {
    expect(crossChecks("location", { location_precision: "exact" }, true).latitude).toBeDefined();
  });
  it("rounds public pins to ~1 km unless the exact location is chosen", () => {
    expect(publicCoordinate(12.295810, "approximate")).toBe(12.3);
    expect(publicCoordinate(76.639381, "approximate")).toBe(76.64);
    expect(publicCoordinate(76.639381, "exact")).toBe(76.639381);
    expect(publicCoordinate(undefined, "exact")).toBeNull();
  });
});

describe("pricing step", () => {
  const base = { price_unit: "per_night", price_inr: "4500" };
  it("defaults tax to 0, minimum stay to 1 and maximum stay to 30", () => {
    const r = strict("pricing", base);
    expect(r).toMatchObject({ ok: true, data: { tax_percent: 0, min_nights: 1, max_nights: 30, price_inr: 4500 } });
  });
  it("requires a price to continue but not to save a draft", () => {
    expect(strict("pricing", { price_unit: "per_night" }).ok).toBe(false);
    expect(lenient("pricing", { price_unit: "per_night" }).ok).toBe(true);
  });
  it("rejects a maximum stay shorter than the minimum, and half-configured extra-guest pricing", () => {
    expect(crossChecks("pricing", { min_nights: 4, max_nights: 2 }, true).max_nights).toBeDefined();
    expect(crossChecks("pricing", { price_unit: "per_night", included_guests: 2 }, true).extra_guest_fee_inr).toBeDefined();
    expect(crossChecks("pricing", { price_unit: "per_night", extra_guest_fee_inr: 400 }, true).included_guests).toBeDefined();
    expect(crossChecks("pricing", { price_unit: "per_person_night", included_guests: 2 }, true)).toEqual({});
  });
  it("included guests cannot exceed capacity", () => {
    expect(crossChecks("pricing", { price_unit: "per_night", included_guests: 8, extra_guest_fee_inr: 1 }, true, { max_guests: 6 }).included_guests).toBeDefined();
  });
  it("limits stays to 30 nights and tax to 40%", () => {
    expect(strict("pricing", { ...base, max_nights: "45" }).ok).toBe(false);
    expect(strict("pricing", { ...base, tax_percent: "41" }).ok).toBe(false);
  });
});

describe("policies & declarations step", () => {
  const valid = { cancellation_policy: "moderate", contact_name: "Asha Rao", contact_phone: "+91 98450 12345", accept_terms: "on", accept_photo_rights: "on" };
  it("accepts a complete step and normalises the phone number", () => {
    expect(strict("review", valid)).toMatchObject({ ok: true, data: { contact_phone: "+919845012345" } });
  });
  it("will not continue without both declarations", () => {
    const r = strict("review", { ...valid, accept_terms: undefined, accept_photo_rights: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["accept_photo_rights", "accept_terms"]);
  });
  it("rejects a malformed phone or e-mail", () => {
    expect(strict("review", { ...valid, contact_phone: "12" }).ok).toBe(false);
    expect(strict("review", { ...valid, contact_email: "nope" }).ok).toBe(false);
  });
});

describe("form collection", () => {
  it("gathers checkbox lists into arrays and ignores framework fields", () => {
    const fd = new FormData();
    fd.append("amenity_ids", "1"); fd.append("amenity_ids", "4"); fd.append("name", "x"); fd.append("$ACTION_ID_1", "y");
    expect(collectStepValues(fd)).toEqual({ amenity_ids: ["1", "4"], name: "x" });
    expect(strict("amenities", collectStepValues(fd))).toMatchObject({ ok: true, data: { amenity_ids: [1, 4], experience_ids: [] } });
  });
  it("an empty facilities step is valid — facilities are owner claims, never auto-assigned", () => {
    expect(strict("amenities", {})).toMatchObject({ ok: true, data: { amenity_ids: [], experience_ids: [] } });
  });
});
