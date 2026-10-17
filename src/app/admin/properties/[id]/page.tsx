import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Card, CardTitle, DefinitionList, SampleBadge, StatusBadge } from "@/components/app/ui";
import { ReviewListingForm, UserActions } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { propertyImageUrl } from "@/lib/images";
import { formatDateTime, formatINR, PRICE_UNIT_LABEL } from "@/lib/format";
import { toggleFeatured } from "@/app/admin/actions";
import type { Profile, Property, PropertyImage, PropertyPrivate } from "@/lib/db/types";

export const metadata: Metadata = { title: "Review listing" };

export default async function AdminPropertyReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireRole(["admin"], `/admin/properties/${id}`);
  const { data } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Property;
  const [priv, imgs, host, cat, am, ex] = await Promise.all([
    supabase.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    supabase.from("property_images").select("*").eq("property_id", id).order("sort_order"),
    p.host_id ? supabase.from("profiles").select("*").eq("id", p.host_id).maybeSingle() : Promise.resolve({ data: null }),
    p.category_id ? supabase.from("property_categories").select("name").eq("id", p.category_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("property_amenities").select("amenities(name)").eq("property_id", id),
    supabase.from("property_experiences").select("experiences(name)").eq("property_id", id),
  ]);
  const pr = (priv.data ?? {}) as Partial<PropertyPrivate>;
  const images = (imgs.data ?? []) as PropertyImage[];
  const hostProfile = host.data as Profile | null;
  const names = (rows: unknown[] | null, key: string) => (rows ?? []).map((r) => (r as Record<string, { name: string } | null>)[key]?.name).filter(Boolean).join(", ");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/properties" className="text-sm text-forest-700 underline">← All listings</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-medium tracking-tight text-forest-950">{p.name}</h1>
          <StatusBadge status={p.status} />
          {p.is_sample ? <SampleBadge /> : null}
        </div>
        {p.rejection_reason ? <p className="mt-2 text-sm text-red-700">Last note: {p.rejection_reason}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Public details</CardTitle>
            <DefinitionList items={[
              { label: "Category", value: (cat.data as { name: string } | null)?.name },
              { label: "Location", value: [p.city, p.region, p.state, p.postal_code].filter(Boolean).join(", ") },
              { label: "Rooms / guests", value: `${p.rooms_count} rooms · up to ${p.max_guests} guests` },
              { label: "Price", value: p.price_inr !== null ? `${formatINR(p.price_inr)} ${PRICE_UNIT_LABEL[p.price_unit]}` : "Price on request" },
              { label: "Check-in / out", value: `${p.check_in_time.slice(0, 5)} / ${p.check_out_time.slice(0, 5)}` },
              { label: "Cancellation policy", value: p.cancellation_policy },
              { label: "Facilities", value: names(am.data, "amenities") },
              { label: "Experiences", value: names(ex.data, "experiences") },
            ]} />
            <p className="mt-4 text-xs uppercase tracking-wide text-ink/50">Summary</p>
            <p className="mt-1 text-sm text-ink/80">{p.summary || "—"}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-ink/50">Description</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{p.description || "—"}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-ink/50">House rules</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{p.house_rules || "—"}</p>
          </Card>

          <Card>
            <CardTitle>Private owner details</CardTitle>
            <DefinitionList items={[
              { label: "Street address", value: pr.address_line },
              { label: "Contact person", value: pr.contact_name },
              { label: "Contact phone", value: pr.contact_phone },
              { label: "Contact email", value: pr.contact_email },
              { label: "Listed elsewhere", value: pr.current_platforms },
              { label: "Partnership model", value: pr.partnership_model },
              { label: "Host terms accepted", value: p.terms_accepted_at ? formatDateTime(p.terms_accepted_at) : "No" },
              { label: "Submitted", value: p.submitted_at ? formatDateTime(p.submitted_at) : "Not yet" },
            ]} />
          </Card>

          <Card>
            <CardTitle>Photographs ({images.length})</CardTitle>
            {images.length === 0 ? <p className="text-sm text-ink/55">No photographs.</p> : (
              <ul className="grid gap-3 sm:grid-cols-3">
                {images.map((i) => {
                  const url = propertyImageUrl(i.path, i.source);
                  return <li key={i.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-forest-50">{url ? <Image src={url} alt={i.alt || "Listing photo"} fill sizes="25vw" className="object-cover" /> : null}</li>;
                })}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardTitle>Decision</CardTitle>
            <ReviewListingForm propertyId={p.id} status={p.status} />
          </Card>
          {p.status === "approved" ? (
            <Card>
              <CardTitle>Featured</CardTitle>
              <form action={toggleFeatured.bind(null, p.id, !p.is_featured)}>
                <button type="submit" className="inline-flex h-10 items-center rounded-full border border-forest-900/20 bg-white px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">{p.is_featured ? "Remove from featured" : "Mark as featured"}</button>
              </form>
            </Card>
          ) : null}
          <Card>
            <CardTitle>Host</CardTitle>
            {hostProfile ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium text-forest-950">{hostProfile.full_name || "—"}</p>
                <p className="text-ink/65">{hostProfile.email}<br />{hostProfile.phone}</p>
                <UserActions userId={hostProfile.id} role={hostProfile.role} suspended={hostProfile.is_suspended} verified={hostProfile.host_verified} />
              </div>
            ) : <p className="text-sm text-ink/60">Platform-managed listing (no individual host).</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
