import { DatabaseZap } from "lucide-react";

/** Shown instead of a broken screen when the Supabase backend has not been configured. */
export function BackendNotice({ feature = "This feature" }: { feature?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-sand-300 bg-sand-50 p-8 text-center">
      <DatabaseZap className="mx-auto h-8 w-8 text-sand-500" aria-hidden="true" />
      <h2 className="mt-4 font-display text-2xl text-forest-950">Coming online shortly</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">
        {feature} needs the Hasiru Nidhi database and sign-in service, which hasn&apos;t been connected
        to this deployment yet. The rest of the site works normally.
      </p>
    </div>
  );
}
