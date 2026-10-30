import { TriangleAlert } from "lucide-react";

export const DEMO_NOTICE = "This is a demonstration property. Prices, images and availability are illustrative and do not represent a verified real-world property.";

/** Prominent notice on every demonstration property page. */
export function DemoNotice() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950" data-testid="demo-notice">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div>
        <p className="font-bold uppercase tracking-wide">Demo listing — sample data</p>
        <p className="mt-1">{DEMO_NOTICE}</p>
      </div>
    </div>
  );
}
