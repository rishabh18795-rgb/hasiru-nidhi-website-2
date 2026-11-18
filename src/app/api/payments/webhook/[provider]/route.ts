import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/payments";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";

// Provider callbacks are server-to-server: never cached, never prerendered.
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await request.text();
  const outcome = await handlePaymentWebhook(
    {
      getProvider: getPaymentProvider,
      record: async (name, event) => {
        if (!isServiceRoleConfigured()) throw new Error("service role not configured");
        const { data, error } = await createAdminSupabase().rpc("record_payment_event", {
          p_provider: name, p_event_id: event.eventId, p_event_type: event.type, p_booking: event.bookingId,
          p_provider_reference: event.reference, p_amount: event.amountInr, p_payload: { type: event.type, reference: event.reference },
        });
        if (error) throw error;
        return data === "duplicate" ? "duplicate" : "recorded";
      },
    },
    provider,
    raw,
    request.headers.get("x-signature") ?? request.headers.get("x-razorpay-signature"),
  );
  return NextResponse.json(outcome.body, { status: outcome.status });
}
