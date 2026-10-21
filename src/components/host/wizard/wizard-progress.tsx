import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { WIZARD_STEPS, stepIndex, wizardPath, type WizardStepKey } from "@/lib/wizard/steps";

/**
 * Progress indicator for the listing wizard. Every step is a real page backed by the saved draft, so steps are
 * links (not fake tabs): hosts can jump back to edit anything. Before the draft exists (step 1) they are inert.
 */
export function WizardProgress({ propertyId, current }: { propertyId?: string; current: WizardStepKey }) {
  const at = stepIndex(current);
  return (
    <nav aria-label="Listing progress" className="rounded-2xl border border-forest-900/10 bg-white p-4 sm:p-5">
      <p className="text-sm font-medium text-forest-950 sm:hidden">
        Step {at + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[at].label}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest-900/10 sm:hidden" role="progressbar" aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length} aria-valuenow={at + 1} aria-label="Listing progress">
        <div className="h-full rounded-full bg-forest-700 transition-all" style={{ width: `${((at + 1) / WIZARD_STEPS.length) * 100}%` }} />
      </div>
      <ol className="hidden items-center sm:flex">
        {WIZARD_STEPS.map((s, i) => {
          const done = i < at;
          const active = i === at;
          const dot = (
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              active ? "bg-forest-800 text-cream ring-4 ring-forest-800/15" : done ? "bg-forest-600 text-cream" : "bg-forest-900/8 text-forest-900/55")}>
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
          );
          const label = <span className={cn("mt-1.5 block text-center text-[11px] leading-tight", active ? "font-semibold text-forest-950" : "text-ink/60")}>{s.short}</span>;
          return (
            <li key={s.key} className="flex flex-1 items-start last:flex-none" aria-current={active ? "step" : undefined}>
              <div className="flex w-14 flex-col items-center">
                {propertyId ? <Link href={wizardPath(propertyId, s.key)} aria-label={`${s.label}${done ? " (completed)" : ""}`}>{dot}</Link> : dot}
                {label}
              </div>
              {i < WIZARD_STEPS.length - 1 ? <span aria-hidden="true" className={cn("mt-4 h-0.5 flex-1", done ? "bg-forest-600" : "bg-forest-900/10")} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
