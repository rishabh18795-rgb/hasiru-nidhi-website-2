import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { Card } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { applicationReference } from "@/lib/wizard/reference";

export const metadata: Metadata = { title: "Listing submitted" };

/** Shown only when the database says the listing really is pending review — never on the strength of a click alone. */
export default async function Submitted({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await requireRole(["host"], `/host/properties/${id}/submitted`);
  const { data: p } = await supabase.from("properties").select("id, name, status, submitted_at").eq("id", id).eq("host_id", user.id).maybeSingle();
  if (!p) notFound();
  if (p.status !== "pending_review" || !p.submitted_at) redirect(`/host/properties/${id}`);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl bg-forest-50 p-8 text-center ring-1 ring-forest-900/10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-forest-700" aria-hidden="true" />
        <h1 className="mt-4 font-display text-3xl text-forest-950">Your listing is submitted</h1>
        <p className="mt-2 text-sm text-ink/70">{p.name} is now waiting for review by the Hasiru Nidhi team.</p>
        <p className="mt-6 text-xs uppercase tracking-wide text-ink/55">Application reference</p>
        <p className="mt-1 font-mono text-2xl tracking-wider text-forest-950" data-testid="application-reference">{applicationReference(p.id)}</p>
        <p className="mt-1 text-xs text-ink/55">Submitted {formatDateTime(p.submitted_at)}</p>
      </div>
      <Card>
        <h2 className="font-display text-xl text-forest-950">What happens next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink/75">
          <li>An administrator reviews your details and photographs. Your listing stays private until then.</li>
          <li>You&apos;ll get a notification when it is approved, or with the changes we need if it isn&apos;t.</li>
          <li>Once approved, it appears on the Explore Stays page and travellers can send you booking requests.</li>
          <li>You accept or decline each request from your host dashboard. Nothing is charged online.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/host/properties" className="inline-flex h-11 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">View my properties</Link>
          <Link href="/host" className="inline-flex h-11 items-center rounded-full border border-forest-900/20 px-6 text-sm font-medium text-forest-900 hover:bg-forest-50">Back to dashboard</Link>
        </div>
      </Card>
    </div>
  );
}
