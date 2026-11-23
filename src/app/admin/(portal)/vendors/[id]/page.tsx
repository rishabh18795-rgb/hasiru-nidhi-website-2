import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { CapabilityDecisionForm, DocumentDecisionForm, VendorDecisionForm } from "@/components/admin/marketplace-forms";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { BUSINESS_TYPES, CAPABILITY_INFO } from "@/lib/validation/vendor";
import type { Vendor, VendorCapability, VendorDocument } from "@/lib/db/types";

export const metadata: Metadata = { title: "Vendor" };

export default async function AdminVendorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole(["admin"], `/admin/vendors/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: v } = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();
  if (!v) notFound();
  const vendor = v as Vendor;
  const [{ data: caps }, { data: docs }, { data: owner }, { data: areas }, { data: audit }] = await Promise.all([
    supabase.from("vendor_capabilities").select("*").eq("vendor_id", id).order("capability"),
    supabase.from("vendor_documents").select("*").eq("vendor_id", id).order("created_at"),
    supabase.from("profiles").select("email, full_name, phone, role").eq("id", vendor.owner_id).maybeSingle(),
    supabase.from("vendor_service_areas").select("scope, pin_code, pin_prefix").eq("vendor_id", id),
    supabase.from("audit_logs").select("id, action, details, created_at").eq("entity_type", "vendor").eq("entity_id", id).order("id", { ascending: false }).limit(25),
  ]);
  const capabilities = (caps ?? []) as VendorCapability[];
  const documents = (docs ?? []) as VendorDocument[];
  // Short-lived links to the private files: only an administrator's session can create them.
  const signed = await Promise.all(documents.map(async (d) => (await supabase.storage.from("vendor-documents").createSignedUrl(d.storage_path, 300)).data?.signedUrl ?? null));
  const areaList = (scope: string) => (areas ?? []).filter((a) => a.scope === scope).map((a) => (a.pin_code ?? `${a.pin_prefix}*`) as string);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/vendors" className="text-sm text-forest-700 underline">← All vendors</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{vendor.business_name}</h1><StatusBadge status={vendor.status} /></div>
        <p className="mt-1 text-sm text-ink/65">{vendor.is_legacy_host ? "Existing stay host, carried over without re-verification. " : ""}Applied {vendor.submitted_at ? formatDateTime(vendor.submitted_at) : "(not submitted)"}</p>
      </div>

      <Card>
        <CardTitle>Business</CardTitle>
        <DefinitionList items={[
          { label: "Type", value: BUSINESS_TYPES.find((b) => b.value === vendor.business_type)?.label },
          { label: "Owner account", value: [owner?.full_name, owner?.email].filter(Boolean).join(" · ") },
          { label: "Contact", value: [vendor.contact_name, vendor.contact_phone, vendor.contact_email].filter(Boolean).join(" · ") },
          { label: "Address", value: [vendor.address_line, vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(", ") },
          { label: "Tax identifier (declared, not verified)", value: vendor.tax_identifier },
          { label: "About", value: vendor.description },
          { label: "Delivery areas", value: areaList("delivery").join(", ") },
          { label: "Service areas", value: areaList("service").join(", ") },
        ]} />
      </Card>

      <Card>
        <CardTitle>Decision on the business</CardTitle>
        <VendorDecisionForm vendorId={vendor.id} status={vendor.status} />
        {vendor.rejection_reason ? <p className="mt-3 text-sm text-ink/65">Last reason recorded: {vendor.rejection_reason}</p> : null}
      </Card>

      <Card>
        <CardTitle>Capabilities (approved one by one)</CardTitle>
        {capabilities.length === 0 ? <p className="text-sm text-ink/65">No capability has been requested yet.</p> : (
          <ul className="divide-y divide-forest-900/8">
            {capabilities.map((c) => (
              <li key={c.capability} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-forest-950">{CAPABILITY_INFO[c.capability].label}</p><StatusBadge status={c.status} /></div>
                {c.reason ? <p className="text-xs text-ink/65">Reason: {c.reason}</p> : null}
                <CapabilityDecisionForm vendorId={vendor.id} capability={c.capability} status={c.status} vendorApproved={vendor.status === "approved"} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Verification documents</CardTitle>
        {documents.length === 0 ? <p className="text-sm text-ink/65">No documents uploaded.</p> : (
          <ul className="divide-y divide-forest-900/8">
            {documents.map((d, i) => (
              <li key={d.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-forest-950">{d.label}{d.original_name ? <span className="ml-2 text-xs font-normal text-ink/65">{d.original_name}</span> : null}</p>
                  <span className="flex items-center gap-3"><StatusBadge status={d.status} />{signed[i] ? <a href={signed[i]!} target="_blank" rel="noopener noreferrer" className="text-sm text-forest-700 underline">Open (5 min link)</a> : <span className="text-xs text-ink/65">File unavailable</span>}</span>
                </div>
                {d.reviewer_note ? <p className="text-xs text-ink/65">Note: {d.reviewer_note}</p> : null}
                <DocumentDecisionForm vendorId={vendor.id} documentId={d.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        <ul className="space-y-1.5 text-sm text-ink/70">
          {(audit ?? []).length === 0 ? <li>No events recorded.</li> : (audit ?? []).map((a) => <li key={a.id as number}><span className="text-ink/65">{formatDateTime(a.created_at as string)}</span> · {(a.action as string).replace(/_/g, " ")}</li>)}
        </ul>
      </Card>
    </div>
  );
}
