import type { Metadata } from "next";

import { PropertyForm } from "@/components/host/property-form";
import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/data/catalog";
import { BackendNotice } from "@/components/site/backend-notice";

export const metadata: Metadata = { title: "Add a property" };

export default async function NewProperty() {
  const session = await requireRole(["host"], "/host/properties/new");
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Add a property</h1>
        <p className="mt-1 text-sm text-ink/60">Step 1 of 3 — details. Next you&apos;ll add photographs, then submit for review. Your profile: {session.profile.full_name || session.user.email}.</p>
      </div>
      {catalog.categories.length === 0 ? <BackendNotice feature="Adding a property" /> : <PropertyForm initial={{}} catalog={catalog} />}
    </div>
  );
}
