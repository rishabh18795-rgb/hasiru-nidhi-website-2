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
  const [{ count }, { count: vendorQueue }, { count: productQueue }, { count: requestQueue }, { count: serviceQueue }] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("vendors").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("order_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
  ]);
  const items = [
    { href: "/admin", label: "Overview", icon: "overview", exact: true },
    { href: "/admin/properties", label: "Listings", icon: "queue", badge: count ?? 0 },
    { href: "/admin/hosts", label: "Hosts", icon: "hosts" },
    { href: "/admin/vendors", label: "Vendors", icon: "vendors", badge: vendorQueue ?? 0 },
    { href: "/admin/products", label: "Products", icon: "queue", badge: productQueue ?? 0 },
    { href: "/admin/product-categories", label: "Product categories", icon: "catalog" },
    { href: "/admin/orders", label: "Shop orders", icon: "bookings", badge: requestQueue ?? 0 },
    { href: "/admin/order-policies", label: "Return policies", icon: "reports" },
    { href: "/admin/services", label: "Services", icon: "queue", badge: serviceQueue ?? 0 },
    { href: "/admin/service-categories", label: "Service categories", icon: "catalog" },
    { href: "/admin/service-requests", label: "Service requests", icon: "bookings" },
    { href: "/admin/marketplace", label: "Marketplace", icon: "marketplace" },
    { href: "/admin/customers", label: "Customers", icon: "users" },
    { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
    { href: "/admin/payments", label: "Payments", icon: "payments" },
    { href: "/admin/commission", label: "Commission", icon: "commission" },
    { href: "/admin/settlements", label: "Settlements", icon: "settlements" },
    { href: "/admin/gardening", label: "Gardening", icon: "gardening" },
    { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries" },
    { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
    { href: "/admin/reports", label: "Reports", icon: "reports" },
    { href: "/admin/catalog", label: "Catalogue", icon: "catalog" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/audit-logs", label: "Audit log", icon: "audit" },
  ] as const;
  return <DashboardShell area="Administration" items={[...items]}>{children}</DashboardShell>;
}
