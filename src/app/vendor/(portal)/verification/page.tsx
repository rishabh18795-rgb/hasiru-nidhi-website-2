import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardTitle } from "@/components/app/ui";
import { DocumentSlot } from "@/components/vendor/document-uploader";
import { requireUser } from "@/lib/auth";
import { getVendorContext } from "@/lib/vendor";
import { CAPABILITY_INFO } from "@/lib/validation/vendor";
import type { VendorCapabilityKind, VendorDocument, VendorDocumentRequirement } from "@/lib/db/types";

export const metadata: Metadata = { title: "Verification" };

export default async function VendorVerificationPage() {
  const { supabase, user } = await requireUser("/vendor/verification");
  const { vendor } = await getVendorContext(supabase, user.id);
  if (!vendor) redirect("/vendor/profile");
  const [{ data: reqs }, { data: docs }] = await Promise.all([
    supabase.from("vendor_document_requirements").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("vendor_documents").select("*").eq("vendor_id", vendor.id).order("created_at"),
  ]);
  const requirements = (reqs ?? []) as VendorDocumentRequirement[];
  const documents = (docs ?? []) as VendorDocument[];
  const locked = vendor.status === "suspended";
  const groups = (["products", "services", "stays"] as VendorCapabilityKind[]).map((k) => ({ k, items: requirements.filter((r) => r.capability === k) })).filter((g) => g.items.length);
  const general = documents.filter((d) => d.requirement_id === null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Verification documents</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Our team decides which documents are needed for each part of the marketplace and may change that list. Files are private: only you and our verification team can open them. Uploading a document does not by itself approve you for anything.</p>
      </div>
      {groups.length === 0 ? (
        <Card><p className="text-sm text-ink/70">No specific documents are required at the moment. You can still upload supporting documents below, and our team may ask for more during review.</p></Card>
      ) : null}
      {groups.map((g) => (
        <Card key={g.k}>
          <CardTitle>{CAPABILITY_INFO[g.k].label}</CardTitle>
          <div className="space-y-3">
            {g.items.map((r) => (
              <DocumentSlot key={r.id} vendorId={vendor.id} requirementId={r.id} label={r.name} hint={r.description} required={r.is_required}
                docs={documents.filter((d) => d.requirement_id === r.id)} disabled={locked} />
            ))}
          </div>
        </Card>
      ))}
      <Card>
        <CardTitle>Other supporting documents</CardTitle>
        <DocumentSlot vendorId={vendor.id} requirementId={null} label="Supporting document" hint="Optional. JPG, PNG, WebP or PDF, up to 10 MB." docs={general} disabled={locked} />
      </Card>
    </div>
  );
}
