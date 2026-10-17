/**
 * PAYMENT INTEGRATION — INTENTIONALLY NOT ENABLED.
 *
 * Bookings today are REQUESTS settled directly between guest and host; the platform holds no
 * funds and the UI says so everywhere (see /cancellation-policy and /terms). This module is the
 * documented seam where an online payment provider (e.g. Razorpay for INR) plugs in once the
 * business has a merchant account and credentials.
 *
 * To enable payments you will need (none of these exist yet):
 *   1. A Razorpay (or similar) merchant account with KYC completed.
 *   2. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (server-only) + a webhook secret.
 *   3. A `payments` table, a server action that creates an order for a CONFIRMED booking, and a
 *      webhook route that verifies the provider signature before marking anything paid.
 *   4. Updated refund logic and policy text that follow the cancellation policy automatically.
 *
 * Until then `getPaymentProvider()` returns null and nothing may report a payment as successful.
 */
export interface PaymentOrder {
  id: string;
  amountPaise: number;
  currency: "INR";
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: { bookingId: string; amountPaise: number }): Promise<PaymentOrder>;
  /** Must verify the provider's cryptographic signature; never trust a client-supplied "paid" flag. */
  verifyWebhook(rawBody: string, signature: string): Promise<{ bookingId: string; paid: boolean }>;
}

export function isPaymentsEnabled(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()) && false;
}

export function getPaymentProvider(): PaymentProvider | null {
  // No provider is implemented. Returning null makes every caller fall back to "pay the host directly".
  return null;
}
