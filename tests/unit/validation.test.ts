import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { stayRequestSchema } from "@/lib/validation/booking";
import { contactEnquirySchema, gardeningEnquirySchema, partnerApplicationSchema } from "@/lib/validation/enquiries";
import { propertyFormSchema, slugify } from "@/lib/validation/property";

const validSignUp = { full_name: "Asha Rao", email: "Asha@Example.com ", phone: "+91 98765 43210", password: "Sup3rSecretPass", confirm_password: "Sup3rSecretPass", account_type: "traveller", accept_terms: "on" };

describe("signUpSchema", () => {
  it("accepts a valid sign-up and normalises the email", () => {
    const r = signUpSchema.safeParse(validSignUp);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("asha@example.com");
  });
  it("rejects an attempt to register as admin", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, account_type: "admin" }).success).toBe(false);
  });
  it("enforces password strength and confirmation", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, password: "short", confirm_password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignUp, password: "alllowercase123", confirm_password: "alllowercase123" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignUp, confirm_password: "different" }).success).toBe(false);
  });
  it("requires accepting the terms", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, accept_terms: undefined }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("requires a valid email and a password", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("stayRequestSchema", () => {
  const base = { property_id: "6f1c1c1e-2b7c-4f4a-9b52-0c9d1e8a7c11", check_in: "2026-11-01", check_out: "2026-11-03", adults: "2", children: "1" };
  it("coerces numbers and accepts valid requests", () => {
    const r = stayRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ adults: 2, children: 1 });
  });
  it("rejects bad ids, impossible dates, reversed ranges and zero adults", () => {
    expect(stayRequestSchema.safeParse({ ...base, property_id: "not-a-uuid" }).success).toBe(false);
    expect(stayRequestSchema.safeParse({ ...base, check_in: "2026-02-31" }).success).toBe(false);
    expect(stayRequestSchema.safeParse({ ...base, check_out: "2026-10-30" }).success).toBe(false);
    expect(stayRequestSchema.safeParse({ ...base, adults: "0" }).success).toBe(false);
  });
});

describe("contactEnquirySchema", () => {
  it("requires a way to reply", () => {
    expect(contactEnquirySchema.safeParse({ name: "Ravi", message: "Hello there" }).success).toBe(false);
    expect(contactEnquirySchema.safeParse({ name: "Ravi", message: "Hello there", phone: "9876543210" }).success).toBe(true);
  });
  it("rejects a filled honeypot", () => {
    expect(contactEnquirySchema.safeParse({ name: "Bot", email: "b@b.co", message: "spam spam", website: "http://spam" }).success).toBe(false);
  });
});

describe("partnerApplicationSchema", () => {
  const base = { owner_name: "Owner", email: "o@example.com", phone: "+919876543210", property_name: "Green Acres", city: "Mysuru", consent: "on" };
  it("treats blank optional numbers as not provided (regression: '' used to coerce to 0 and fail)", () => {
    const r = partnerApplicationSchema.safeParse({ ...base, rooms_count: "", max_guests: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rooms_count).toBeUndefined();
    expect(partnerApplicationSchema.safeParse({ ...base, rooms_count: "0" }).success).toBe(false);
    expect(partnerApplicationSchema.safeParse({ ...base, rooms_count: "12" }).success).toBe(true);
  });
  it("requires privacy consent", () => {
    expect(partnerApplicationSchema.safeParse(base).success).toBe(true);
    expect(partnerApplicationSchema.safeParse({ ...base, consent: undefined }).success).toBe(false);
  });
});

describe("gardeningEnquirySchema", () => {
  const base = { name: "Meera", phone: "9876543210", location: "Whitefield", property_type: "Villa", services: ["lawn"] };
  it("accepts a valid quote request", () => expect(gardeningEnquirySchema.safeParse(base).success).toBe(true));
  it("rejects unknown services and property types", () => {
    expect(gardeningEnquirySchema.safeParse({ ...base, services: ["hack"] }).success).toBe(false);
    expect(gardeningEnquirySchema.safeParse({ ...base, property_type: "Castle" }).success).toBe(false);
  });
});

describe("propertyFormSchema", () => {
  const base = {
    name: "Green Cottage", category_id: "3", summary: "", description: "x".repeat(60), city: "Mysuru", state: "Karnataka", region: "",
    postal_code: "", rooms_count: "2", max_guests: "4", price_inr: "", price_unit: "per_night", check_in_time: "14:00", check_out_time: "11:00",
    house_rules: "", cancellation_policy: "moderate", amenity_ids: ["1", "2"], experience_ids: [],
  };
  it("parses numeric strings and treats an empty price as 'on request'", () => {
    const r = propertyFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ category_id: 3, rooms_count: 2, max_guests: 4, price_inr: undefined, amenity_ids: [1, 2] });
  });
  it("rejects negative or absurd values and unknown policies", () => {
    expect(propertyFormSchema.safeParse({ ...base, price_inr: "-1" }).success).toBe(false);
    expect(propertyFormSchema.safeParse({ ...base, max_guests: "0" }).success).toBe(false);
    expect(propertyFormSchema.safeParse({ ...base, cancellation_policy: "free-for-all" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("  Hasiru Nidhi — Garden Cottage! ")).toBe("hasiru-nidhi-garden-cottage");
    expect(slugify("¡¡¡")).toBe("property");
  });
});
