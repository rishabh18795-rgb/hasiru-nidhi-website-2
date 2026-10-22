import type { Metadata } from "next";

import { DashboardShell } from "@/components/app/dashboard-shell";
import { requireRole } from "@/lib/auth";

// Everything under this segment depends on the signed-in user: never prerender it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Host portal", template: "%s — Host portal" },
  robots: { index: false, follow: false },
};

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireRole(["host"], "/host");
  // Pending request count for the nav badge (RLS limits this to the host's own listings).
  const [{ count }, { count: unread }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);
  const items = [
    { href: "/host", label: "Overview", icon: "overview", exact: true },
    { href: "/host/properties", label: "My properties", icon: "properties" },
    { href: "/host/bookings", label: "Bookings", icon: "bookings", badge: count ?? 0 },
    { href: "/host/calendar", label: "Calendar", icon: "calendar" },
    { href: "/host/enquiries", label: "Enquiries", icon: "enquiries" },
    { href: "/host/notifications", label: "Notifications", icon: "notifications", badge: unread ?? 0 },
    { href: "/host/settings", label: "Profile", icon: "settings" },
    { href: "/dashboard", label: "My trips", icon: "saved" },
  ] as const;
  return <DashboardShell area="Host portal" items={[...items]}>{children}</DashboardShell>;
}
