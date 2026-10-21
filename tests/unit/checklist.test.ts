import { describe, expect, it } from "vitest";

import { isComplete, listingChecklist } from "@/lib/wizard/checklist";

const complete = {
  name: "Coorg Coffee Cottage", category_id: 2, city: "Madikeri", state: "Karnataka", country: "India",
  description: "x".repeat(80), max_guests: 6, rooms_count: 3, bedrooms: 3, beds: 4, bathrooms: 2,
  accommodation_arrangement: "entire_property" as const, price_inr: 4500, cancellation_policy: "moderate" as const,
  terms_accepted_at: "2026-10-21T00:00:00Z", photo_rights_confirmed_at: "2026-10-21T00:00:00Z",
};
const priv = { address_line: "12 Estate Road", contact_name: "Asha", contact_phone: "+919845012345" };

describe("listing checklist", () => {
  it("is complete only when every item is satisfied", () => {
    expect(isComplete(listingChecklist(complete, priv, 3))).toBe(true);
  });

  it.each([
    ["no photographs", { ...complete }, priv, 0, "photos"],
    ["a short description", { ...complete, description: "short" }, priv, 3, "description"],
    ["no price", { ...complete, price_inr: null }, priv, 3, "price"],
    ["no address", complete, { ...priv, address_line: " " }, 3, "address"],
    ["no phone", complete, { ...priv, contact_phone: null }, 3, "contact"],
    ["terms not accepted", { ...complete, terms_accepted_at: null }, priv, 3, "terms"],
    ["rights not confirmed", { ...complete, photo_rights_confirmed_at: null }, priv, 3, "rights"],
    ["no bedrooms recorded", { ...complete, bedrooms: null }, priv, 3, "rooms"],
  ])("flags %s and points at the step that fixes it", (_n, p, pv, images, key) => {
    const items = listingChecklist(p, pv, images);
    expect(isComplete(items)).toBe(false);
    expect(items.find((i) => !i.ok)?.key).toBe(key);
  });

  it("a brand-new draft has everything outstanding", () => {
    const blank = { ...complete, name: "x", category_id: null, city: null, state: null, description: "", bedrooms: null, beds: null, bathrooms: null, accommodation_arrangement: null, price_inr: null, terms_accepted_at: null, photo_rights_confirmed_at: null };
    expect(listingChecklist(blank, null, 0).every((i) => !i.ok)).toBe(true);
  });
});
