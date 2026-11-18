import { createHmac, timingSafeEqual } from "node:crypto";

import type { PaymentEvent, PaymentProvider } from "@/lib/payments";

export type WebhookOutcome =
  | { status: 200; body: { ok: true; result: "recorded" | "duplicate" } }
  | { status: 400 | 401 | 404 | 500 | 503; body: { ok: false; error: string } };

/** Constant-time check of an HMAC-SHA256 hex signature, for provider adapters that sign the raw body that way. */
export function verifyHmacSha256(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = signature.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export interface WebhookDeps {
  /** Resolves the adapter for a provider name, or null when that provider is not configured. */
  getProvider: (name: string) => PaymentProvider | null;
  /** Calls the database's record_payment_event() with the service role. Returns its result ("recorded" | "duplicate"). */
  record: (providerName: string, event: PaymentEvent) => Promise<"recorded" | "duplicate">;
}

/**
 * The whole webhook decision, independent of Next.js so it can be tested: no provider -> 503; unverifiable signature -> 401
 * and nothing is recorded; a verified event is recorded exactly once (a replay is acknowledged, not applied again).
 */
export async function handlePaymentWebhook(deps: WebhookDeps, providerName: string, rawBody: string, signature: string | null): Promise<WebhookOutcome> {
  if (!/^[a-z0-9_-]{1,40}$/.test(providerName)) return { status: 404, body: { ok: false, error: "unknown_provider" } };
  const provider = deps.getProvider(providerName);
  if (!provider) return { status: 503, body: { ok: false, error: "payments_not_enabled" } };
  if (!signature) return { status: 401, body: { ok: false, error: "missing_signature" } };

  let event: PaymentEvent | null;
  try {
    event = await provider.verifyWebhook(rawBody, signature);
  } catch {
    return { status: 400, body: { ok: false, error: "unreadable_event" } };
  }
  if (!event) return { status: 401, body: { ok: false, error: "invalid_signature" } };

  try {
    return { status: 200, body: { ok: true, result: await deps.record(providerName, event) } };
  } catch {
    // A rejected event (e.g. a payment for an unconfirmed booking) is the provider's problem to retry or investigate.
    return { status: 400, body: { ok: false, error: "event_rejected" } };
  }
}
