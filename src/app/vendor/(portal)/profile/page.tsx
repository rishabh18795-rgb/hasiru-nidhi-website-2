import type { Metadata } from "next";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { VendorProfileForm } from "@/components/vendor/profile-form";
import { requireUser } from "@/lib/auth";
import { getVendorContext, VENDOR_STATUS_COPY } from "@/lib/vendor";
import { BUSINESS_TYPES } from "@/lib/validation/vendor";

export const metadata: Metadata = { title: "Business profile" };

export default async function VendorProfilePage() {
  const { supabase, user } = await requireUser("/vendor/profile");
  const { vendor, capabilities } = await getVendorContext(supabase, user.id);
  const readOnly = vendor && ["submitted", "under_review", "suspended"].includes(vendor.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">{vendor ? "Business profile" : "Apply as a vendor"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Tell us about your business. Our team verifies it before you can sell, offer services or host stays. Your private details are never shown to customers.</p>
      </div>
      {vendor ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink/70"><span className="font-medium text-forest-950">{VENDOR_STATUS_COPY[vendor.status].title}.</span> {VENDOR_STATUS_COPY[vendor.status].body}</p>
          <StatusBadge status={vendor.status === "submitted" || vendor.status === "under_review" ? "pending_review" : vendor.status} />
        </Card>
      ) : null}
      {vendor?.status === "rejected" && vendor.rejection_reason ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Reviewer note: {vendor.rejection_reason}</p> : null}
      <Card>
        <CardTitle>Business details</CardTitle>
        {readOnly ? (
          <DefinitionList items={[
            { label: "Business name", value: vendor.business_name },
            { label: "Type", value: BUSINESS_TYPES.find((b) => b.value === vendor.business_type)?.label },
            { label: "Contact", value: [vendor.contact_name, vendor.contact_phone, vendor.contact_email].filter(Boolean).join(" · ") },
            { label: "Address", value: [vendor.address_line, vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(", ") },
            { label: "Tax identifier", value: vendor.tax_identifier },
            { label: "About", value: vendor.description },
          ]} />
        ) : (
          <VendorProfileForm vendor={vendor} requested={capabilities.map((c) => c.capability)} />
        )}
      </Card>
    </div>
  );
}
