import type { Metadata } from "next";

import { DashboardShell } from "@/components/app/dashboard-shell";
import { requireRole } from "@/lib/auth";

// Everything under this segment depends on the signed-in user: never prerender it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireRole(["admin"], "/admin");
  const { count } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending_review");
  const items = [
    { href: "/admin", label: "Overview", icon: "overview", exact: true },
    { href: "/admin/properties", label: "Listings", icon: "queue", badge: count ?? 0 },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
    { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries" },
    { href: "/admin/reports", label: "Reports", icon: "reports" },
    { href: "/admin/catalog", label: "Catalogue", icon: "catalog" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ] as const;
  return <DashboardShell area="Administration" items={[...items]}>{children}</DashboardShell>;
}
