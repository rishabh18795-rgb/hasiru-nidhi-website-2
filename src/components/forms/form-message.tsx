import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { FormState } from "@/lib/action";
import { cn } from "@/lib/utils";

/** Success / error banner for a server-action form. Announced to screen readers. */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  if (!state?.message) return null;
  const ok = Boolean(state.ok);
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        ok ? "border-forest-300 bg-forest-50 text-forest-900" : "border-red-200 bg-red-50 text-red-800",
        className,
      )}
    >
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <p>{state.message}</p>
    </div>
  );
}
