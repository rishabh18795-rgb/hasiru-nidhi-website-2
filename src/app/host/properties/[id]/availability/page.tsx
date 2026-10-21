import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AvailabilityPanel } from "@/components/host/availability-panel";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await requireRole(["host"], `/host/properties/${id}/availability`);
  const { data: p } = await supabase.from("properties").select("id, name").eq("id", id).eq("host_id", user.id).maybeSingle();
  if (!p) notFound();
  return (
    <div className="space-y-8">
      <div>
        <Link href={`/host/properties/${id}`} className="text-sm text-forest-700 underline">← {p.name}</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">Availability calendar</h1>
        <p className="mt-1 text-sm text-ink/60">Block dates you can&apos;t host. Confirmed bookings block dates automatically, and you can&apos;t block nights that already have a confirmed stay.</p>
      </div>
      <AvailabilityPanel supabase={supabase} propertyId={id} />
    </div>
  );
}
