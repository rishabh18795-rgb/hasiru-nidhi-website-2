import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppPage, EmptyState } from "@/components/app/ui";
import { DashboardShell } from "@/components/app/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { getMarketplaceFlags } from "@/lib/flags";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";

// Everything under this segment depends on the signed-in user: never prerender it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Vendor dashboard", template: "%s — Vendor dashboard" },
  robots: { index: false, follow: false },
};

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireUser("/vendor");
  if (profile.role === "admin") redirect("/admin");
  const flags = await getMarketplaceFlags();
  if (!flags.vendorRegistration) {
    return (
      <AppPage title="Vendor dashboard" narrow>
        <EmptyState
          title="Vendor registration is not open yet"
          description="We are preparing the Hasiru Nidhi marketplace. Existing stay hosts continue to use the Host portal as usual."
          action={profile.role === "host" ? { href: "/host", label: "Go to the Host portal" } : { href: "/dashboard", label: "Back to my account" }}
        />
      </AppPage>
    );
  }

  // Existing hosts are carried over without re-verification (idempotent, audited). Done before any cached read.
  if (profile.role === "host") {
    const { data: existing } = await supabase.from("vendors").select("id").eq("owner_id", user.id).maybeSingle();
    if (!existing) await supabase.rpc("ensure_legacy_vendor");
  }
  const ctx = await getVendorContext(supabase, user.id);
  const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);

  const items = [
    { href: "/vendor", label: "Overview", icon: "overview", exact: true },
    { href: "/vendor/profile", label: ctx.vendor ? "Business profile" : "Apply as a vendor", icon: "settings" },
    ...(ctx.vendor
      ? [
          { href: "/vendor/verification", label: "Verification", icon: "verification" },
          { href: "/vendor/coverage", label: "Delivery & service areas", icon: "coverage" },
        ]
      : []),
    ...(isCapabilityActive(ctx, "products")
      ? [
          { href: "/vendor/products", label: "Products", icon: "catalog" },
          { href: "/vendor/inventory", label: "Inventory", icon: "earnings" },
        ]
      : []),
    ...(isCapabilityActive(ctx, "stays") && profile.role === "host" ? [{ href: "/host", label: "Stays (host portal)", icon: "properties" }] : []),
    { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", badge: unread ?? 0 },
    { href: "/dashboard", label: "My account", icon: "saved" },
  ] as const;
  return <DashboardShell area="Vendor dashboard" items={[...items]}>{children}</DashboardShell>;
}
