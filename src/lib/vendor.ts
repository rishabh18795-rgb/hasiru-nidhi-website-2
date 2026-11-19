import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Vendor, VendorCapability, VendorCapabilityKind } from "@/lib/db/types";

export interface VendorContext {
  vendor: Vendor | null;
  capabilities: VendorCapability[];
}

/** The signed-in user's vendor (if any) and its capabilities. RLS limits both queries to the caller's own rows. */
export const getVendorContext = cache(async (supabase: SupabaseClient, userId: string): Promise<VendorContext> => {
  const { data: vendor } = await supabase.from("vendors").select("*").eq("owner_id", userId).maybeSingle();
  if (!vendor) return { vendor: null, capabilities: [] };
  const { data: caps } = await supabase.from("vendor_capabilities").select("*").eq("vendor_id", (vendor as Vendor).id).order("capability");
  return { vendor: vendor as Vendor, capabilities: (caps ?? []) as VendorCapability[] };
});

/** A vertical is usable only when the vendor itself and that capability are both approved (the database enforces the same rule). */
export function isCapabilityActive(ctx: VendorContext, capability: VendorCapabilityKind): boolean {
  return ctx.vendor?.status === "approved" && ctx.capabilities.some((c) => c.capability === capability && c.status === "approved");
}

export const VENDOR_STATUS_COPY: Record<string, { title: string; body: string }> = {
  draft: { title: "Draft", body: "Complete your business profile and documents, then submit your application." },
  submitted: { title: "Submitted", body: "Our team will review your application. You will be notified of the decision." },
  under_review: { title: "Under review", body: "Our team is reviewing your application." },
  approved: { title: "Verified", body: "Your business is verified. Each thing you want to do (products, services, stays) is approved separately." },
  rejected: { title: "Changes needed", body: "Your application needs changes. Update it and submit again." },
  suspended: { title: "Suspended", body: "This vendor account is suspended. Please contact support." },
};
