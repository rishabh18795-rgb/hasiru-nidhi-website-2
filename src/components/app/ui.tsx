import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/format";

/** Frame for app pages (auth, dashboards). Clears the fixed site header. */
export function AppPage({
  title,
  description,
  actions,
  children,
  narrow,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("bg-cream pb-24 pt-32", className)}>
      <div className={cn("container-nidhi", narrow && "max-w-xl")}>
        {title ? (
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-medium tracking-tight text-forest-950 sm:text-4xl">{title}</h1>
              {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">{description}</p> : null}
            </div>
            {actions}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-forest-900/10 bg-white p-6 shadow-sm shadow-forest-950/[0.03]", className)}>{children}</div>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl text-forest-950">{children}</h2>
      {aside}
    </div>
  );
}

const TONES: Record<string, string> = {
  approved: "bg-forest-100 text-forest-800",
  confirmed: "bg-forest-100 text-forest-800",
  completed: "bg-forest-50 text-forest-700",
  pending_review: "bg-sand-100 text-earth-700",
  requested: "bg-sand-100 text-earth-700",
  draft: "bg-stone-100 text-stone-700",
  rejected: "bg-red-50 text-red-700",
  suspended: "bg-red-50 text-red-700",
  cancelled_by_traveller: "bg-stone-100 text-stone-600",
  cancelled_by_host: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[status] ?? "bg-stone-100 text-stone-700")}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800" title="Demonstration data, not a real property">
      Sample listing
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-xl text-forest-950">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{description}</p> : null}
      {action ? (
        <Link href={action.href} className="mt-5 inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1.5 font-display text-3xl text-forest-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink/50">{hint}</p> : null}
    </Card>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs uppercase tracking-wide text-ink/50">{i.label}</dt>
          <dd className="mt-0.5 text-ink/85">{i.value || <span className="text-ink/40">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
