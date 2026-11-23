import { AlertTriangle } from "lucide-react";

import { PAYMENT_EXPLAINER, PAYMENT_LABEL } from "@/lib/orders";
import { SERVICE_PAYMENT_EXPLAINER } from "@/lib/services";
import { cn } from "@/lib/utils";

/** The same wording everywhere an order or checkout is shown. There is no payment gateway; nothing here can ever say "paid". */
export function PaymentBadge({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300", className)} data-testid="payment-status"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{PAYMENT_LABEL}</span>;
}

export function PaymentNotice({ className }: { className?: string }) {
  return (
    <div role="note" className={cn("rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950", className)}>
      <PaymentBadge />
      <p className="mt-2 leading-relaxed">{PAYMENT_EXPLAINER}</p>
    </div>
  );
}

/** The same unpaid wording for service requests. */
export function ServicePaymentNotice({ className }: { className?: string }) {
  return (
    <div role="note" className={cn("rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950", className)}>
      <PaymentBadge />
      <p className="mt-2 leading-relaxed">{SERVICE_PAYMENT_EXPLAINER}</p>
    </div>
  );
}
