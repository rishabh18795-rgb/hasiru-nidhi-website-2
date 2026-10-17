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
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "requested");
  const items = [
    { href: "/host", label: "Overview", icon: "overview", exact: true },
    { href: "/host/properties", label: "My properties", icon: "properties" },
    { href: "/host/bookings", label: "Booking requests", icon: "bookings", badge: count ?? 0 },
    { href: "/host/enquiries", label: "Enquiries", icon: "enquiries" },
    { href: "/host/settings", label: "Settings", icon: "settings" },
    { href: "/dashboard", label: "My trips", icon: "saved" },
  ] as const;
  return <DashboardShell area="Host portal" items={[...items]}>{children}</DashboardShell>;
}
