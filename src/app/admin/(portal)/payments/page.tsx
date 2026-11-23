import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/app/ui";
import { RecordPaymentForm, RefundForm } from "@/components/admin/finance-forms";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { BookingFinancial, PaymentRow } from "@/lib/db/types";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPayments() {
  const { supabase } = await requireRole(["admin"], "/admin/payments");
  const [{ data: bookings }, { data: payments }] = await Promise.all([
    supabase.from("booking_financials").select("*").in("status", ["confirmed", "completed"]).in("payment_status", ["unpaid", "initiated", "failed"]).order("check_in", { ascending: true }).limit(100),
    supabase.from("payments").select("*, bookings(property_name, guest_name)").order("created_at", { ascending: false }).limit(100),
  ]);
  const owing = (bookings ?? []) as BookingFinancial[];
  const paid = (payments ?? []) as unknown as (PaymentRow & { bookings: { property_name: string; guest_name: string } | null })[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Payments</h1>
        <p role="note" className="mt-3 max-w-3xl rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">
          No online payment gateway is connected yet, so the platform does not collect money. This page records payments that were <b>actually received</b> (bank transfer, UPI, cash). Each entry is audited. When a gateway is configured, its verified webhook events will appear here as well.
        </p>
      </div>

      <section aria-labelledby="owing-h" className="space-y-3">
        <h2 id="owing-h" className="text-lg font-medium text-forest-950">Confirmed bookings without a recorded payment</h2>
        {owing.length === 0 ? <EmptyState title="Nothing waiting for a payment" /> : (
          <ul className="space-y-3">
            {owing.map((b) => (
              <li key={b.booking_id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-forest-950">{b.property_name}</p>
                    <span className="rounded-full bg-sand-50 px-2.5 py-0.5 text-xs capitalize text-earth-800">{b.payment_status}</span>
                  </div>
                  <p className="text-sm text-ink/70">{b.guest_name} · {formatDate(b.check_in)} → {formatDate(b.check_out)} · booking total {b.gross_inr !== null ? formatINR(b.gross_inr) : "—"}</p>
                  <RecordPaymentForm bookingId={b.booking_id} suggested={b.gross_inr ?? undefined} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="received-h" className="space-y-3">
        <h2 id="received-h" className="text-lg font-medium text-forest-950">Recorded payments</h2>
        {paid.length === 0 ? <EmptyState title="No payments recorded yet" /> : (
          <ul className="space-y-3">
            {paid.map((p) => {
              const remaining = Number(p.amount_inr) - Number(p.refunded_inr);
              return (
                <li key={p.id}>
                  <Card className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-forest-950">{formatINR(p.amount_inr)} <span className="text-sm font-normal text-ink/65">· {p.bookings?.property_name ?? "booking"} · {p.bookings?.guest_name ?? ""}</span></p>
                      <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs capitalize text-forest-800">{p.status.replace("_", " ")}</span>
                    </div>
                    <p className="text-xs text-ink/65">{p.provider} · ref {p.provider_reference} · {formatDateTime(p.created_at)}{Number(p.refunded_inr) > 0 ? ` · refunded ${formatINR(p.refunded_inr)}` : ""}{p.note ? ` · ${p.note}` : ""}</p>
                    {remaining > 0 && (p.status === "paid" || p.status === "partially_refunded") ? <RefundForm paymentId={p.id} max={remaining} /> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
