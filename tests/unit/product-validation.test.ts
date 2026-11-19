import { describe, expect, it } from "vitest";

import { adjustSchema, attributesToText, optionsToText, parseLabelLines, productSchema, variantSchema } from "../../src/lib/validation/product";
import { activeShopFilterCount, parseShopFilters, shopFiltersToQuery } from "../../src/lib/shop/filters";
import { friendlyDbError } from "../../src/lib/action";
import { productImageUrl } from "../../src/lib/images";
import { formatPrice } from "../../src/lib/format";

describe("label lines (specifications and variant options)", () => {
  it("parses 'Label: value' lines, keeps colons inside values, and ignores blank lines", () => {
    expect(parseLabelLines("Height: 20 cm\n\n  Pot : biodegradable: yes \n", 20)).toEqual({ items: [{ label: "Height", value: "20 cm" }, { label: "Pot", value: "biodegradable: yes" }], errors: [] });
  });
  it("reports malformed or oversized lines instead of guessing", () => {
    expect(parseLabelLines("just words\n: nolabel\nlabel:", 20).errors).toHaveLength(3);
    expect(parseLabelLines(`${"x".repeat(61)}: v`, 20).errors[0]).toMatch(/too long/);
    expect(parseLabelLines("a: 1\nb: 2\nc: 3", 2).errors.join()).toMatch(/at most 2/);
  });
  it("round-trips for the edit form", () => {
    expect(parseLabelLines(attributesToText([{ label: "Height", value: "20 cm" }]), 20).items).toEqual([{ label: "Height", value: "20 cm" }]);
    expect(optionsToText({ Size: "Medium", "Pot size": "6 inch" })).toBe("Size: Medium\nPot size: 6 inch");
  });
});

describe("product form validation", () => {
  const ok = { name: "Tulsi sapling", category_id: "1", summary: "", description: "", brand: "", specifications: "" };
  it("accepts a draft with only the basics", () => { expect(productSchema.safeParse(ok).success).toBe(true); });
  it("needs a name and a category, with clear messages", () => {
    const r = productSchema.safeParse({ ...ok, name: "ab", category_id: "" });
    const flat = r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
    expect(flat).toMatchObject({ name: expect.stringMatching(/at least 3/), category_id: expect.stringMatching(/category/i) });
  });
  it("limits the summary", () => { expect(productSchema.safeParse({ ...ok, summary: "x".repeat(241) }).success).toBe(false); });
});

describe("variant and stock validation", () => {
  const ok = { product_id: "11111111-1111-4111-8111-111111111111", sku: "NC-1KG", name: "1 kg bag", options: "", price_inr: "149.50", weight_grams: "", initial_stock: "", track_inventory: "on", is_active: "on" };
  it("accepts a normal variant and converts form text", () => {
    const r = variantSchema.parse(ok);
    expect(r).toMatchObject({ price_inr: 149.5, initial_stock: 0, track_inventory: true, is_active: true });
    expect(r.weight_grams).toBeUndefined();
  });
  it("treats an unticked box as false", () => { expect(variantSchema.parse({ ...ok, track_inventory: undefined, is_active: undefined })).toMatchObject({ track_inventory: false, is_active: false }); });
  it("rejects bad SKUs, free or negative prices and fractional weights", () => {
    expect(variantSchema.safeParse({ ...ok, sku: "has space" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...ok, price_inr: "0" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...ok, price_inr: "-5" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...ok, weight_grams: "2.5" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...ok, initial_stock: "-1" }).success).toBe(false);
  });
  it("accepts stock adjustments only with a known reason and whole numbers", () => {
    const base = { variant_id: "11111111-1111-4111-8111-111111111111", mode: "add", quantity: "-3", reason: "damaged", note: "" };
    expect(adjustSchema.parse(base).quantity).toBe(-3);
    expect(adjustSchema.safeParse({ ...base, reason: "initial" }).success).toBe(false);
    expect(adjustSchema.safeParse({ ...base, quantity: "1.5" }).success).toBe(false);
    expect(adjustSchema.safeParse({ ...base, mode: "multiply" }).success).toBe(false);
  });
});

describe("shop URL filters", () => {
  it("defaults are safe and unfiltered", () => {
    expect(parseShopFilters({})).toEqual({ q: "", pin: "", min: null, max: null, inStock: false, vendor: "", sort: "newest", page: 1 });
  });
  it("sanitises hostile input", () => {
    const f = parseShopFilters({ q: "  rose  ", pin: "56007", min: "abc", max: "9999999999", sort: "drop table", page: "-3", vendor: "A B", stock: "yes" });
    expect(f).toMatchObject({ q: "rose", pin: "", min: null, max: null, sort: "newest", page: 1, vendor: "", inStock: false });
  });
  it("accepts a PIN, a price range (swapping reversed bounds) and paging", () => {
    expect(parseShopFilters({ pin: "560078", min: "500", max: "100", stock: "1", sort: "price_asc", page: "3", vendor: "green-roots-abc123" })).toEqual({ q: "", pin: "560078", min: 100, max: 500, inStock: true, vendor: "green-roots-abc123", sort: "price_asc", page: 3 });
  });
  it("builds a clean query string and counts active filters", () => {
    const f = parseShopFilters({ pin: "560078", stock: "1", sort: "name", page: "2" });
    expect(shopFiltersToQuery(f)).toBe("?pin=560078&stock=1&sort=name&page=2");
    expect(shopFiltersToQuery(parseShopFilters({}))).toBe("");
    expect(activeShopFilterCount(f)).toBe(2);
  });
});

describe("messages and image URLs", () => {
  it.each([
    ["incomplete_product: images,delivery_areas", /at least one photo.*delivery PIN codes/],
    ["capability_not_approved", /needs approval/],
    ["duplicate_sku", /already has a variant/],
    ["last_image", /at least one photo/],
    ["product_locked_in_review", /being reviewed/],
  ])("explains %s", (raw, pattern) => { expect(friendlyDbError({ message: raw })).toMatch(pattern); });
  it("builds public product image URLs only from a configured storage host", () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
    expect(productImageUrl("v/p/a.jpg")).toBe("https://example.supabase.co/storage/v1/object/public/product-images/v/p/a.jpg");
    expect(productImageUrl(null)).toBeNull();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(productImageUrl("v/p/a.jpg")).toBeNull();
    if (prev !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
  });
});

describe("product prices are never rounded", () => {
  it("shows whole rupees as whole and everything else with paise", () => {
    expect(formatPrice(450)).toBe("₹450");
    expect(formatPrice("149.50")).toBe("₹149.50");
    expect(formatPrice(149.5)).toBe("₹149.50");
    expect(formatPrice(1234567.05)).toBe("₹12,34,567.05");
    expect(formatPrice(0.01)).toBe("₹0.01");
    expect(formatPrice(null)).toBe("");
    expect(formatPrice("abc")).toBe("");
  });
});
