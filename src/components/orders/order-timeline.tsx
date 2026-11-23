import { Check, X } from "lucide-react";

import { ORDER_STATUS_SHORT, TIMELINE } from "@/lib/orders";
import type { OrderStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/** Where the order is. Declined and cancelled orders show where they stopped, never as if they were still moving. */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "rejected" || status === "cancelled") {
    return <p className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700"><X className="h-4 w-4" aria-hidden="true" />{ORDER_STATUS_SHORT[status]}</p>;
  }
  const at = TIMELINE.indexOf(status);
  return (
    <ol className="flex items-center" aria-label="Order progress">
      {TIMELINE.map((s, i) => (
        <li key={s} className={cn("flex items-center", i < TIMELINE.length - 1 && "flex-1")} aria-current={i === at ? "step" : undefined}>
          <span className="flex flex-col items-center gap-1.5">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-2", i < at ? "bg-forest-700 text-cream ring-forest-700" : i === at ? "bg-white text-forest-800 ring-forest-700" : "bg-white text-ink/65 ring-forest-900/15")}>
              {i < at ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-[11px] font-medium sm:text-xs", i <= at ? "text-forest-900" : "text-ink/65")}>{ORDER_STATUS_SHORT[s]}</span>
          </span>
          {i < TIMELINE.length - 1 ? <span className={cn("mx-1 mb-5 h-0.5 flex-1 rounded", i < at ? "bg-forest-700" : "bg-forest-900/15")} aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}
