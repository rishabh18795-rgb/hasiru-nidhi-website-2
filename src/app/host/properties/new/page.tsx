import type { Metadata } from "next";

import { BackendNotice } from "@/components/site/backend-notice";
import { TypeStep } from "@/components/host/wizard/step-forms";
import { WizardProgress } from "@/components/host/wizard/wizard-progress";
import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Add a property" };

export default async function NewProperty() {
  await requireRole(["host"], "/host/properties/new");
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">List your property</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Eight short steps. Your progress is saved as a draft after every step, so you can leave and come back. Nothing is public until our team approves the listing.</p>
      </div>
      <WizardProgress current="type" />
      {catalog.categories.length === 0 ? <BackendNotice feature="Adding a property" /> : <TypeStep initial={{}} catalog={catalog} />}
    </div>
  );
}
