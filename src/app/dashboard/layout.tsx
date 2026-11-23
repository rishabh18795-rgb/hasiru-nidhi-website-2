import type { Metadata } from "next";

import { DashboardShell } from "@/components/app/dashboard-shell";
import { requireUser } from "@/lib/auth";

// Everything under this segment depends on the signed-in user: never prerender it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "My account", template: "%s — My account" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireUser("/dashboard");
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
  const items = [
    { href: "/dashboard", label: "Overview", icon: "overview", exact: true },
    { href: "/dashboard/bookings", label: "Stay bookings", icon: "bookings" },
    { href: "/dashboard/orders", label: "Shop orders", icon: "earnings" },
    { href: "/dashboard/requests", label: "Service requests", icon: "queue" },
    { href: "/dashboard/addresses", label: "Addresses", icon: "coverage" },
    { href: "/dashboard/saved", label: "Favourites", icon: "saved" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", badge: count ?? 0 },
    { href: "/dashboard/profile", label: "Profile", icon: "profile" },
  ] as const;
  return (
    <DashboardShell area={profile.role === "traveller" ? "Traveller" : `${profile.role[0].toUpperCase()}${profile.role.slice(1)} · My trips`} items={[...items]}>
      {children}
    </DashboardShell>
  );
}
