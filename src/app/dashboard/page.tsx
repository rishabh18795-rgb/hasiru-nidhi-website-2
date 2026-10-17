import Link from "next/link";
import { ArrowRight, Store, ShieldCheck } from "lucide-react";

import { Card, CardTitle, EmptyState, Stat, StatusBadge } from "@/components/app/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, todayIST } from "@/lib/format";
import type { Booking } from "@/lib/db/types";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser("/dashboard");
  const today = todayIST();

  const [{ data: rows }, { count: savedCount }] = await Promise.all([
    supabase.from("bookings").select("*").eq("traveller_id", user.id).order("check_in", { ascending: true }),
    supabase.from("saved_properties").select("property_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const bookings = (rows ?? []) as Booking[];
  const requested = bookings.filter((b) => b.status === "requested");
  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.check_out >= today);
  const next = upcoming[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Hello{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="mt-1 text-sm text-ink/60">Your trips, requests and saved stays in one place.</p>
      </div>

      {sp.denied ? <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">You don&apos;t have access to that area with this account.</p> : null}
      {sp.password === "updated" ? <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Your password has been updated.</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting host" value={requested.length} />
        <Stat label="Confirmed trips" value={upcoming.length} />
        <Stat label="Saved stays" value={savedCount ?? 0} />
      </div>

      <Card>
        <CardTitle aside={<Link href="/dashboard/bookings" className="inline-flex items-center gap-1 text-sm text-forest-700 hover:text-forest-900">All bookings <ArrowRight className="h-3.5 w-3.5" /></Link>}>Next trip</CardTitle>
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-forest-950">{next.property_name}</p>
              <p className="text-sm text-ink/65">{formatDate(next.check_in)} → {formatDate(next.check_out)} · {next.adults + next.children} guest(s)</p>
            </div>
            <StatusBadge status={next.status} />
          </div>
        ) : (
          <EmptyState title="No confirmed trips yet" description="Find a stay, send a request, and it will appear here once the host confirms." action={{ href: "/stays", label: "Explore stays" }} />
        )}
      </Card>

      {profile.role !== "traveller" ? (
        <Card className="bg-forest-50">
          <p className="text-sm text-forest-900">
            You&apos;re signed in as a <strong>{profile.role}</strong>.{" "}
            {profile.role === "host" ? (
              <Link href="/host" className="inline-flex items-center gap-1 font-medium underline"><Store className="h-3.5 w-3.5" /> Open the host portal</Link>
            ) : (
              <Link href="/admin" className="inline-flex items-center gap-1 font-medium underline"><ShieldCheck className="h-3.5 w-3.5" /> Open the admin area</Link>
            )}
          </p>
        </Card>
      ) : (
        <Card className="bg-forest-50">
          <p className="text-sm text-forest-900">Own a property in Karnataka? <Link href="/become-a-host" className="font-medium underline">Learn about hosting with Hasiru Nidhi</Link>.</p>
        </Card>
      )}
    </div>
  );
}
