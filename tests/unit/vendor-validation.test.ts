import { describe, expect, it } from "vitest";

import { parsePinList, submitSchema, vendorDraftSchema, vendorProfileSchema } from "../../src/lib/validation/vendor";
import { friendlyDbError } from "../../src/lib/action";

const OK = {
  business_name: "Green Roots Nursery", business_type: "farm", description: "", contact_name: "Alice Rao", contact_email: "Alice@Example.com", contact_phone: "+91 98765 43210",
  address_line: "12 Garden Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078", tax_identifier: "",
};

describe("vendor application validation", () => {
  it("accepts a complete profile and normalises it", () => {
    const r = vendorProfileSchema.parse(OK);
    expect(r.contact_email).toBe("alice@example.com");
    expect(r.contact_phone).toBe("+919876543210");
    expect(r.description).toBeUndefined();
  });
  it("needs every field to submit, with clear messages", () => {
    const r = vendorProfileSchema.safeParse({ ...OK, contact_phone: "", contact_email: "", postal_code: "56007", business_type: "" });
    expect(r.success).toBe(false);
    const flat = r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
    expect(flat).toMatchObject({ postal_code: expect.stringMatching(/6-digit/), business_type: expect.any(String), contact_phone: expect.any(String), contact_email: expect.any(String) });
  });
  it("lets a draft be saved with blanks, but never with a malformed value", () => {
    expect(vendorDraftSchema.safeParse({ business_name: "Draft Co" }).success).toBe(true);
    expect(vendorDraftSchema.safeParse({ business_name: "Draft Co", postal_code: "12" }).success).toBe(false);
    expect(vendorDraftSchema.safeParse({ business_name: "X" }).success).toBe(false);
  });
  it("requires at least one known capability to submit", () => {
    expect(submitSchema.safeParse({ capabilities: [] }).success).toBe(false);
    expect(submitSchema.safeParse({ capabilities: ["products", "services", "stays"] }).success).toBe(true);
    expect(submitSchema.safeParse({ capabilities: ["admin"] }).success).toBe(false);
  });
});

describe("PIN coverage input", () => {
  it("accepts 6-digit PINs and 3-digit prefixes in any separator and removes duplicates", () => {
    expect(parsePinList("560078, 560078\n562 ;110001")).toEqual({ codes: ["560078", "562", "110001"], invalid: [] });
  });
  it("reports invalid tokens instead of silently dropping them", () => {
    expect(parsePinList("560078 56007 abc 5600789").invalid).toEqual(["56007", "abc", "5600789"]);
    expect(parsePinList("").codes).toEqual([]);
  });
});

describe("friendly database messages for vendors", () => {
  it.each([
    ["vendor_registration_closed", /not open yet/],
    ["incomplete_vendor: contact_phone,document:Identity proof", /contact phone number.*Identity proof/],
    ["vendor_not_approved", /Approve the vendor/],
    ["invalid_pin: 12ab56", /6 digits/],
  ])("explains %s", (raw, pattern) => {
    expect(friendlyDbError({ message: raw })).toMatch(pattern);
  });
});
