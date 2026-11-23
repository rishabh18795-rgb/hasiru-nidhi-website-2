import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/app/ui";
import { ServicesGate } from "@/components/vendor/capability-gate";
import { ServiceForm } from "@/components/vendor/service-form";
import { requireUser } from "@/lib/auth";
import { getServiceCategories } from "@/lib/data/services";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  const { supabase, user } = await requireUser("/vendor/services/new");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "services")) return <ServicesGate ctx={ctx} />;
  const categories = await getServiceCategories();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor/services" className="text-sm text-forest-700 underline">← All services</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">New service</h1>
        <p className="mt-1 text-sm text-ink/60">Start with the basics. After you save, you can add photos and submit it for review.</p>
      </div>
      <Card><CardTitle>Service details</CardTitle><ServiceForm service={null} categories={categories} /></Card>
    </div>
  );
}
