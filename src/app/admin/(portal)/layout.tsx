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
  const [{ count }, { count: vendorQueue }, { count: productQueue }, { count: requestQueue }, { count: serviceQueue }, { count: reviewQueue }] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("vendors").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("order_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("marketplace_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const items = [
    { href: "/admin", label: "Overview", icon: "overview", exact: true },
    { href: "/admin/properties", label: "Listings", icon: "queue", badge: count ?? 0, group: "Stays" },
    { href: "/admin/hosts", label: "Hosts", icon: "hosts", group: "Stays" },
    { href: "/admin/bookings", label: "Bookings", icon: "bookings", group: "Stays" },
    { href: "/admin/reviews", label: "Reviews", icon: "reviews", group: "Stays" },
    { href: "/admin/vendors", label: "Vendors", icon: "vendors", badge: vendorQueue ?? 0, group: "Marketplace" },
    { href: "/admin/products", label: "Products", icon: "queue", badge: productQueue ?? 0, group: "Marketplace" },
    { href: "/admin/product-categories", label: "Product categories", icon: "catalog", group: "Marketplace" },
    { href: "/admin/orders", label: "Shop orders", icon: "bookings", badge: requestQueue ?? 0, group: "Marketplace" },
    { href: "/admin/order-policies", label: "Return policies", icon: "reports", group: "Marketplace" },
    { href: "/admin/services", label: "Services", icon: "queue", badge: serviceQueue ?? 0, group: "Marketplace" },
    { href: "/admin/service-categories", label: "Service categories", icon: "catalog", group: "Marketplace" },
    { href: "/admin/service-requests", label: "Service requests", icon: "bookings", group: "Marketplace" },
    { href: "/admin/marketplace-reviews", label: "Marketplace reviews", icon: "reviews", badge: reviewQueue ?? 0, group: "Marketplace" },
    { href: "/admin/marketplace", label: "Marketplace", icon: "marketplace", group: "Marketplace" },
    { href: "/admin/payments", label: "Payments", icon: "payments", group: "Money" },
    { href: "/admin/commission", label: "Commission", icon: "commission", group: "Money" },
    { href: "/admin/settlements", label: "Settlements", icon: "settlements", group: "Money" },
    { href: "/admin/marketplace-finance", label: "Marketplace finance", icon: "payments", group: "Money" },
    { href: "/admin/marketplace-commission", label: "Marketplace commission", icon: "commission", group: "Money" },
    { href: "/admin/customers", label: "Customers", icon: "users", group: "People and enquiries" },
    { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", group: "People and enquiries" },
    { href: "/admin/gardening", label: "Gardening", icon: "gardening", group: "People and enquiries" },
    { href: "/admin/reports", label: "Reports", icon: "reports", group: "People and enquiries" },
    { href: "/admin/catalog", label: "Catalogue", icon: "catalog", group: "Platform" },
    { href: "/admin/settings", label: "Settings", icon: "settings", group: "Platform" },
    { href: "/admin/audit-logs", label: "Audit log", icon: "audit", group: "Platform" },
  ] as const;
  return <DashboardShell area="Administration" items={[...items]}>{children}</DashboardShell>;
}
