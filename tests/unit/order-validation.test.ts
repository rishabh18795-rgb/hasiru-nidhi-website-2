import { describe, expect, it } from "vitest";

import { addressSchema, cancelSchema, decisionSchema, disputeSchema, policySchema, returnSchema, trackingSchema } from "../../src/lib/validation/order";
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, TIMELINE, customerActions, newIdempotencyKey } from "../../src/lib/orders";
import { friendlyDbError } from "../../src/lib/action";

const ID = "11111111-1111-4111-8111-111111111111";

describe("delivery address validation", () => {
  const ok = { full_name: "Alice Rao", phone: "+91 98765 43210", line1: "12 Garden Road", line2: "", landmark: "", city: "Bengaluru", state: "Karnataka", postal_code: "560078", label: "", is_default: "on" };
  it("accepts a complete address and normalises the phone", () => {
    const r = addressSchema.parse(ok);
    expect(r.phone).toBe("+919876543210");
    expect(r.is_default).toBe(true);
  });
  it("needs a 6-digit PIN and the required fields", () => {
    const r = addressSchema.safeParse({ ...ok, postal_code: "5600", line1: "", phone: "12" });
    const flat = r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
    expect(Object.keys(flat).sort()).toEqual(["line1", "phone", "postal_code"]);
  });
  it("an unticked default box means false", () => { expect(addressSchema.parse({ ...ok, is_default: undefined }).is_default).toBe(false); });
});

describe("order request validation", () => {
  it("cancel: reason is optional, order id must be a uuid", () => {
    expect(cancelSchema.safeParse({ order_id: ID }).success).toBe(true);
    expect(cancelSchema.safeParse({ order_id: "x" }).success).toBe(false);
  });
  it("return: only return or replacement, with a reason", () => {
    expect(returnSchema.safeParse({ order_id: ID, kind: "return", reason: "Damaged" }).success).toBe(true);
    expect(returnSchema.safeParse({ order_id: ID, kind: "cancel", reason: "Damaged" }).success).toBe(false);
    expect(returnSchema.safeParse({ order_id: ID, kind: "return", reason: "x" }).success).toBe(false);
  });
  it("dispute needs a real description", () => {
    expect(disputeSchema.safeParse({ order_id: ID, description: "short" }).success).toBe(false);
    expect(disputeSchema.safeParse({ order_id: ID, description: "The seller never replied to me." }).success).toBe(true);
  });
  it("tracking needs a carrier and number, and a web link if any", () => {
    expect(trackingSchema.safeParse({ order_id: ID, carrier: "DTDC", tracking: "AB123", url: "" }).success).toBe(true);
    expect(trackingSchema.safeParse({ order_id: ID, carrier: "", tracking: "AB123", url: "" }).success).toBe(false);
    expect(trackingSchema.safeParse({ order_id: ID, carrier: "DTDC", tracking: "AB123", url: "javascript:alert(1)" }).success).toBe(false);
    expect(trackingSchema.safeParse({ order_id: ID, carrier: "DTDC", tracking: "AB123", url: "https://t.example.com/x" }).success).toBe(true);
  });
  it("decisions are limited to the known set", () => {
    expect(decisionSchema.safeParse({ id: ID, decision: "approve", note: "" }).success).toBe(true);
    expect(decisionSchema.safeParse({ id: ID, decision: "refund", note: "" }).success).toBe(false);
  });
  it("policy windows are whole days from 1 to 365, blank meaning no limit", () => {
    expect(policySchema.parse({ category_id: "3", returns_allowed: "true", return_window_days: "", replacements_allowed: "", replacement_window_days: "", notes: "" }).return_window_days).toBeUndefined();
    expect(policySchema.safeParse({ category_id: "3", returns_allowed: "true", return_window_days: "0", replacements_allowed: "", replacement_window_days: "" }).success).toBe(false);
    expect(policySchema.safeParse({ category_id: "3", returns_allowed: "maybe", return_window_days: "", replacements_allowed: "", replacement_window_days: "" }).success).toBe(false);
  });
});

describe("order wording and rules", () => {
  it("the payment label is always the unpaid one: there is no paid wording anywhere", () => {
    expect(PAYMENT_LABEL).toBe("UNPAID: PAYMENT NOT CONFIGURED");
    expect(Object.values(ORDER_STATUS_LABEL).join(" ")).not.toMatch(/payment (received|successful|confirmed)/i);
  });
  it("the timeline runs placed to delivered", () => { expect(TIMELINE).toEqual(["placed", "confirmed", "packed", "shipped", "delivered"]); });
  it("what a customer can do follows the order's stage", () => {
    expect(customerActions("placed")).toEqual({ cancel: "now", returns: false });
    expect(customerActions("confirmed")).toEqual({ cancel: "request", returns: false });
    expect(customerActions("packed")).toEqual({ cancel: "request", returns: false });
    expect(customerActions("shipped")).toEqual({ cancel: null, returns: false });
    expect(customerActions("delivered")).toEqual({ cancel: null, returns: true });
    expect(customerActions("cancelled")).toEqual({ cancel: null, returns: false });
  });
  it("idempotency keys are unique and long enough for the database", () => {
    const a = newIdempotencyKey(), b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });
  it.each([
    ["insufficient_stock:3", /Only 3 available/],
    ["out_of_stock:Tulsi sapling (Small)", /Tulsi sapling \(Small\) is out of stock/],
    ["not_deliverable:Seller B", /Seller B does not deliver to this PIN code/],
    ["not_allowed_by_policy:Gardening tools", /policy for Gardening tools/],
    ["window_expired:Seeds", /window for Seeds has passed/],
    ["cannot_cancel", /can no longer be cancelled/],
    ["orders_closed", /not open yet/],
    ["tracking_required", /tracking number/],
  ])("explains %s", (raw, pattern) => { expect(friendlyDbError({ message: raw })).toMatch(pattern); });
});
