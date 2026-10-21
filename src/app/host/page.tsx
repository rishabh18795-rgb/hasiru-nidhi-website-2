import Link from "next/link";
import { Plus } from "lucide-react";

import { Card, CardTitle, EmptyState, Stat, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { todayIST } from "@/lib/format";
import type { Property } from "@/lib/db/types";
import { wizardPath } from "@/lib/wizard/steps";

export default async function HostOverview() {
  const { supabase, user, profile } = await requireRole(["host"], "/host");
  const today = todayIST();
  const [{ data: props }, { count: requested }, { count: upcoming }, { count: enquiries }, { count: unread }] = await Promise.all([
    supabase.from("properties").select("id, name, status, rejection_reason, review_kind, wizard_step, updated_at").eq("host_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").gt("check_out", today),
    supabase.from("contact_enquiries").select("id", { count: "exact", head: true }).not("property_id", "is", null).eq("status", "new"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
  ]);
  const list = (props ?? []) as Pick<Property, "id" | "name" | "status" | "rejection_reason" | "review_kind" | "wizard_step" | "updated_at">[];
  const by = (s: string) => list.filter((p) => p.status === s).length;
  const attention = list.filter((p) => p.status === "rejected" || p.status === "suspended");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-forest-950">Host dashboard</h1>
          <p className="mt-1 text-sm text-ink/60">Welcome{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}. Manage your listings, calendar and booking requests.</p>
        </div>
        <Link href="/host/properties/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700"><Plus className="h-4 w-4" aria-hidden="true" /> Add a property</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Drafts" value={by("draft")} />
        <Stat label="Pending review" value={by("pending_review")} />
        <Stat label="Live listings" value={by("approved")} />
        <Stat label="Need changes" value={by("rejected") + by("suspended")} />
        <Stat label="Requests to answer" value={requested ?? 0} />
        <Stat label="Upcoming stays" value={upcoming ?? 0} />
        <Stat label="New enquiries" value={enquiries ?? 0} />
        <Stat label="Unread notifications" value={unread ?? 0} />
      </div>

      {profile.host_verified ? null : (
        <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">Your host account isn&apos;t verified yet. An administrator verifies hosts after reviewing their first listing.</p>
      )}

      {attention.length ? (
        <Card className="border-red-200 bg-red-50/60">
          <CardTitle>Needs your attention</CardTitle>
          <ul className="space-y-3">
            {attention.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
                <div>
                  <Link href={p.status === "rejected" ? wizardPath(p.id, "review") : `/host/properties/${p.id}`} className="font-medium text-forest-950 underline">{p.name}</Link>
                  {p.rejection_reason ? <p className="mt-1 text-ink/70">{p.status === "rejected" && p.review_kind === "changes_requested" ? "Changes requested" : p.status === "suspended" ? "Suspended" : "Not approved"}: {p.rejection_reason}</p> : null}
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle aside={<Link href="/host/properties" className="text-sm text-forest-700 underline">View all</Link>}>Your properties</CardTitle>
        {list.length === 0 ? (
          <EmptyState title="Add your first property" description="List it step by step with your own photographs and prices. It's saved as a draft until you submit it, and nothing is public until an administrator approves it." action={{ href: "/host/properties/new", label: "Add a property" }} />
        ) : (
          <ul className="divide-y divide-forest-900/8">
            {list.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <Link href={`/host/properties/${p.id}`} className="font-medium text-forest-950 hover:underline">{p.name}</Link>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
