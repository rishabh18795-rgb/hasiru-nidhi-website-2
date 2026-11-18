import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { getPaymentProvider, isPaymentsEnabled, type PaymentEvent, type PaymentProvider } from "@/lib/payments";
import { handlePaymentWebhook, verifyHmacSha256 } from "@/lib/payments/webhook";

const SECRET = "test-secret-not-a-real-key";
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");
const EVENT: PaymentEvent = { eventId: "evt_1", type: "payment.captured", bookingId: "11111111-1111-4111-8111-111111111111", reference: "pay_1", amountInr: 10000 };

/** A stand-in provider adapter that signs the raw body with HMAC-SHA256, like many real gateways do. */
const fakeProvider: PaymentProvider = {
  name: "fake",
  createOrder: async () => ({ id: "order_1", amountPaise: 1_000_000, currency: "INR" }),
  verifyWebhook: async (raw, signature) => (verifyHmacSha256(raw, signature, SECRET) ? (JSON.parse(raw) as PaymentEvent) : null),
};

describe("payments are not enabled until a provider is integrated", () => {
  it("has no provider and says so", () => {
    expect(getPaymentProvider()).toBeNull();
    expect(getPaymentProvider("razorpay")).toBeNull();
    expect(isPaymentsEnabled()).toBe(false);
  });
});

describe("verifyHmacSha256", () => {
  it("accepts the right signature and nothing else", () => {
    const body = JSON.stringify(EVENT);
    expect(verifyHmacSha256(body, sign(body), SECRET)).toBe(true);
    expect(verifyHmacSha256(body, sign(body).toUpperCase(), SECRET)).toBe(true);
    expect(verifyHmacSha256(body + " ", sign(body), SECRET)).toBe(false);
    expect(verifyHmacSha256(body, sign(body), "another-secret")).toBe(false);
    expect(verifyHmacSha256(body, "", SECRET)).toBe(false);
    expect(verifyHmacSha256(body, sign(body), "")).toBe(false);
    expect(verifyHmacSha256(body, "abc", SECRET)).toBe(false);
  });
});

describe("handlePaymentWebhook", () => {
  const body = JSON.stringify(EVENT);
  const deps = (record = vi.fn(async () => "recorded" as const)) => ({ getProvider: (n: string) => (n === "fake" ? fakeProvider : null), record });

  it("answers 503 and records nothing when the provider is not configured", async () => {
    const d = deps();
    const r = await handlePaymentWebhook(d, "razorpay", body, sign(body));
    expect(r).toEqual({ status: 503, body: { ok: false, error: "payments_not_enabled" } });
    expect(d.record).not.toHaveBeenCalled();
  });

  it("rejects a missing or forged signature (401) without recording anything", async () => {
    const d = deps();
    expect((await handlePaymentWebhook(d, "fake", body, null)).status).toBe(401);
    expect((await handlePaymentWebhook(d, "fake", body, "deadbeef")).status).toBe(401);
    expect((await handlePaymentWebhook(d, "fake", body.replace("10000", "1"), sign(body))).status).toBe(401); // tampered amount
    expect(d.record).not.toHaveBeenCalled();
  });

  it("records a verified event once and acknowledges a replay", async () => {
    const record = vi.fn<() => Promise<"recorded" | "duplicate">>().mockResolvedValueOnce("recorded").mockResolvedValueOnce("duplicate");
    const d = deps(record as never);
    expect(await handlePaymentWebhook(d, "fake", body, sign(body))).toEqual({ status: 200, body: { ok: true, result: "recorded" } });
    expect(await handlePaymentWebhook(d, "fake", body, sign(body))).toEqual({ status: 200, body: { ok: true, result: "duplicate" } });
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledWith("fake", EVENT);
  });

  it("refuses odd provider names and survives bad payloads and rejected events", async () => {
    const d = deps();
    expect((await handlePaymentWebhook(d, "../etc", body, sign(body))).status).toBe(404);
    expect((await handlePaymentWebhook(d, "fake", "{not json", sign("{not json"))).status).toBe(400);
    const failing = deps(vi.fn(async () => { throw new Error("invalid_event"); }));
    expect((await handlePaymentWebhook(failing, "fake", body, sign(body))).status).toBe(400);
  });
});
