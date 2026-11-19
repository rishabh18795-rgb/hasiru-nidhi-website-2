import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle, EmptyState, StatusBadge } from "@/components/app/ui";
import { requireUser } from "@/lib/auth";
import { getVendorContext, VENDOR_STATUS_COPY } from "@/lib/vendor";
import { CAPABILITY_INFO } from "@/lib/validation/vendor";
import { getMarketplaceFlags } from "@/lib/flags";
import { RequestCapability } from "@/components/vendor/request-capability";
import type { VendorCapabilityKind } from "@/lib/db/types";

export const metadata: Metadata = { title: "Overview" };

const KINDS: VendorCapabilityKind[] = ["products", "services", "stays"];

export default async function VendorOverview() {
  const { supabase, user, profile } = await requireUser("/vendor");
  const [ctx, flags] = await Promise.all([getVendorContext(supabase, user.id), getMarketplaceFlags()]);
  const { vendor, capabilities } = ctx;

  if (!vendor) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Sell or host on Hasiru Nidhi</h1>
        <EmptyState
          title="You are not a vendor yet"
          description="Apply with your business details. After we verify your business, you can be approved to sell products, offer services, host stays, or any combination. Each is reviewed separately."
          action={{ href: "/vendor/profile", label: "Start your application" }}
        />
      </div>
    );
  }

  const copy = VENDOR_STATUS_COPY[vendor.status];
  const [{ count: docs }, { count: areas }] = await Promise.all([
    supabase.from("vendor_documents").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id),
    supabase.from("vendor_service_areas").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id),
  ]);
  const byKind = new Map(capabilities.map((c) => [c.capability, c]));
  const moduleOpen: Record<VendorCapabilityKind, boolean> = { products: flags.products, services: flags.services, stays: true };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">{vendor.business_name}</h1>
        <p className="mt-1 text-sm text-ink/60">Vendor dashboard{vendor.is_legacy_host ? " · existing stay host" : ""}</p>
      </div>

      <Card>
        <CardTitle aside={<StatusBadge status={vendor.status === "under_review" ? "pending_review" : vendor.status === "submitted" ? "pending_review" : vendor.status} />}>Verification</CardTitle>
        <p className="text-sm text-ink/70"><span className="font-medium text-forest-950">{copy.title}.</span> {copy.body}</p>
        {vendor.status === "rejected" && vendor.rejection_reason ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Reviewer note: {vendor.rejection_reason}</p> : null}
        {vendor.status === "suspended" && vendor.rejection_reason ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Reason: {vendor.rejection_reason}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="text-forest-700 underline" href="/vendor/profile">Business profile</Link>
          <Link className="text-forest-700 underline" href="/vendor/verification">Documents ({docs ?? 0} uploaded)</Link>
          <Link className="text-forest-700 underline" href="/vendor/coverage">Delivery and service areas ({areas ?? 0})</Link>
        </div>
      </Card>

      <Card>
        <CardTitle>What you can do</CardTitle>
        <ul className="divide-y divide-forest-900/8">
          {KINDS.map((k) => {
            const c = byKind.get(k);
            const approved = c?.status === "approved" && vendor.status === "approved";
            return (
              <li key={k} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-forest-950">{CAPABILITY_INFO[k].label}</p>
                  <p className="text-sm text-ink/60">
                    {!c ? "Not requested." : c.status === "pending" ? "Waiting for our team to review this request." : c.status === "rejected" ? `Not approved${c.reason ? `: ${c.reason}` : "."}` : c.status === "suspended" ? `Suspended${c.reason ? `: ${c.reason}` : "."}` : !approved ? "Approved, but your business is not currently verified." : k === "stays" ? "Approved. Manage properties and bookings in the Host portal." : moduleOpen[k] ? "Approved. Your tools will appear here." : "Approved. Selling tools open when this part of the marketplace launches. Nothing is public yet."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {c ? <StatusBadge status={c.status === "pending" ? "pending_review" : c.status} /> : null}
                  {approved && k === "stays" && profile.role === "host" ? <Link href="/host" className="rounded-full bg-forest-800 px-4 py-2 text-sm font-medium text-cream hover:bg-forest-700">Open Host portal</Link> : null}
                  {vendor.status === "approved" && (!c || c.status === "rejected") ? <RequestCapability capability={k} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
