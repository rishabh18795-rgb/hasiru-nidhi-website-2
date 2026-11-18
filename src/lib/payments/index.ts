/**
 * PAYMENT PROVIDER SEAM — NO PROVIDER IS INTEGRATED YET.
 *
 * Bookings are requests; the platform does not collect money and the UI says so. What exists today is the foundation a provider
 * plugs into, and it is deliberately provider-independent:
 *   - database: payments, payment_events (unique per provider + event id), commission_ledger, host_settlements, refunds, and
 *     record_payment_event() — callable by the server only — which is idempotent and can never mark an unconfirmed booking paid;
 *   - this module: the PaymentProvider interface and getPaymentProvider();
 *   - src/lib/payments/webhook.ts + /api/payments/webhook/[provider]: verifies the signature, then records the event once.
 *
 * To go live with a provider (e.g. Razorpay for INR) the business needs: a merchant account with KYC, API keys and a webhook
 * secret in server-only environment variables, an adapter implementing PaymentProvider (createOrder + verifyWebhook), and a test
 * of real success, failure and refund events in the provider's test environment. Until then getPaymentProvider() is null, the
 * webhook route answers 503, and nothing may report a payment as successful.
 */
export interface PaymentOrder {
  id: string;
  amountPaise: number;
  currency: "INR";
}

/** What a provider adapter must turn a verified webhook into. Amounts are rupees (the database stores INR). */
export interface PaymentEvent {
  /** The provider's unique id for this event: the idempotency key. */
  eventId: string;
  type: "payment.captured" | "payment.failed" | "refund.processed";
  bookingId: string | null;
  /** The provider's payment / order reference. */
  reference: string;
  amountInr: number;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: { bookingId: string; amountPaise: number }): Promise<PaymentOrder>;
  /** Must verify the provider's cryptographic signature and return null when it does not match. Never trust a client-supplied "paid" flag. */
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent | null>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the name is the argument a real adapter lookup will use
export function getPaymentProvider(_name?: string): PaymentProvider | null {
  // No provider is implemented. Returning null makes every caller fall back to "pay the host directly".
  return null;
}

export function isPaymentsEnabled(): boolean {
  return getPaymentProvider() !== null;
}
