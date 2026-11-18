import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Check, Circle, Eye, Pencil } from "lucide-react";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { DeleteDraftForm } from "@/components/host/host-forms";
import { requireRole } from "@/lib/auth";
import { loadHostListing } from "@/lib/data/host-listing";
import { formatDateTime } from "@/lib/format";
import { isComplete, listingChecklist } from "@/lib/wizard/checklist";
import { applicationReference } from "@/lib/wizard/reference";
import { WIZARD_STEPS, wizardPath } from "@/lib/wizard/steps";

export const metadata: Metadata = { title: "Property" };

const STATUS_HELP: Record<string, string> = {
  draft: "Only you can see this listing. Finish the steps below and submit it for review.",
  pending_review: "Submitted — an administrator is reviewing it. It is not public yet and can't be edited until the review is finished.",
  approved: "Live on the site. Changes to the name, description, type or location send it back for re-review.",
  rejected: "Not approved yet. Make the changes requested below and submit it again.",
  suspended: "Removed from the site by an administrator. Contact support to resolve this.",
};

export default async function PropertyOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireRole(["host"], `/host/properties/${id}`);
  const listing = await loadHostListing(supabase, id, user.id);
  if (!listing) notFound();
  const { property: p } = listing;
  const checklist = listingChecklist(p, listing.priv, listing.images.length);
  const firstTodo = checklist.find((c) => !c.ok);
  const resume = firstTodo ? wizardPath(id, firstTodo.step) : wizardPath(id, "review");
  const editable = p.status === "draft" || p.status === "rejected" || p.status === "approved";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-medium tracking-tight text-forest-950">{p.name}</h1>
            <StatusBadge status={p.status} />
            {p.status === "rejected" && p.review_kind === "changes_requested" ? <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-earth-700">Changes requested</span> : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink/65">{STATUS_HELP[p.status]}</p>
          {p.rejection_reason ? <p className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800">Administrator note: {p.rejection_reason}</p> : null}
          {p.submitted_at ? <p className="mt-2 text-xs text-ink/55">Reference {applicationReference(p.id)} · submitted {formatDateTime(p.submitted_at)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? <Link href={resume} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700"><Pencil className="h-4 w-4" aria-hidden="true" /> {p.status === "draft" ? (firstTodo ? "Continue your listing" : "Review & submit") : "Edit listing"}</Link> : null}
          <Link href={`/host/properties/${id}/availability`} className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-900/20 bg-white px-5 text-sm font-medium text-forest-900 hover:bg-forest-50"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Availability</Link>
          {p.status === "approved" ? <Link href={`/stays/${p.slug}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-50 px-5 text-sm font-medium text-forest-800 hover:bg-forest-100"><Eye className="h-4 w-4" aria-hidden="true" /> View live</Link> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{p.status === "approved" ? "Listing completeness" : "Before you submit"}</CardTitle>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2.5">
                {c.ok ? <Check className="h-4 w-4 text-forest-700" aria-label="Done" /> : <Circle className="h-4 w-4 text-red-500" aria-label="To do" />}
                {c.ok || !editable ? <span className="text-ink/75">{c.label}</span> : <Link href={wizardPath(id, c.step)} className="text-red-700 underline underline-offset-2">{c.label}</Link>}
              </li>
            ))}
          </ul>
          {isComplete(checklist) && p.status === "draft" ? <p className="mt-4 text-sm text-forest-800">Everything is filled in. <Link href={wizardPath(id, "review")} className="underline">Review and submit.</Link></p> : null}
        </Card>
        <Card>
          <CardTitle>Sections</CardTitle>
          <ul className="divide-y divide-forest-900/8 text-sm">
            {WIZARD_STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink/80"><span className="mr-2 text-ink/40">{i + 1}.</span>{s.label}</span>
                {editable || p.status === "pending_review" ? <Link href={wizardPath(id, s.key)} className="text-forest-700 underline underline-offset-2">{editable ? "Edit" : "View"}</Link> : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {p.status === "draft" ? (
        <Card className="border-red-200"><CardTitle>Delete draft</CardTitle><p className="mb-3 text-sm text-ink/65">Permanently removes this draft and its photographs. Only drafts can be deleted.</p><DeleteDraftForm propertyId={p.id} /></Card>
      ) : null}
    </div>
  );
}
