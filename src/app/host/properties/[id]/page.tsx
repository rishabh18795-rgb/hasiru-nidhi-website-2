import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { AddRoomTypeForm, DeleteDraftForm, SubmitForReviewForm } from "@/components/host/host-forms";
import { PhotoManager } from "@/components/host/photo-manager";
import { PropertyForm } from "@/components/host/property-form";
import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/data/catalog";
import { deleteRoomType } from "@/app/host/actions";
import { formatDateTime, formatINR } from "@/lib/format";
import type { Property, PropertyImage, PropertyPrivate, RoomType } from "@/lib/db/types";

export const metadata: Metadata = { title: "Edit property" };

const STATUS_HELP: Record<string, string> = {
  draft: "Only you can see this listing. Complete it and submit it for review.",
  pending_review: "Submitted — an administrator is reviewing it. It is not public yet.",
  approved: "Live on the site. Changes to the name, description, category or location send it back for re-review.",
  rejected: "Not approved. Fix the issues below and submit it again.",
  suspended: "Removed from the site by an administrator. Contact support to resolve this.",
};

export default async function EditProperty({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await requireRole(["host"], `/host/properties/${id}`);

  // RLS already limits this to the host's own rows; the explicit host_id filter is defence in depth.
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).eq("host_id", user.id).maybeSingle();
  if (!property) notFound();
  const p = property as Property;

  const [catalog, priv, am, ex, imgs, rooms] = await Promise.all([
    getCatalog(),
    supabase.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    supabase.from("property_amenities").select("amenity_id").eq("property_id", id),
    supabase.from("property_experiences").select("experience_id").eq("property_id", id),
    supabase.from("property_images").select("*").eq("property_id", id).order("sort_order"),
    supabase.from("room_types").select("*").eq("property_id", id).order("name"),
  ]);
  const pr = (priv.data ?? {}) as Partial<PropertyPrivate>;
  const images = (imgs.data ?? []) as PropertyImage[];
  const roomList = (rooms.data ?? []) as RoomType[];
  const canSubmit = p.status === "draft" || p.status === "rejected";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-medium tracking-tight text-forest-950">{p.name}</h1>
            <StatusBadge status={p.status} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink/65">{STATUS_HELP[p.status]}</p>
          {p.rejection_reason ? <p className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800">Administrator note: {p.rejection_reason}</p> : null}
        </div>
        <Link href={`/host/properties/${p.id}/availability`} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-900/20 bg-white px-5 text-sm font-medium text-forest-900 hover:bg-forest-50"><CalendarDays className="h-4 w-4" aria-hidden="true" /> Availability calendar</Link>
      </div>
      {sp.created ? <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Draft saved. Now add photographs, then submit for review.</p> : null}

      <Card id="submit">
        <CardTitle>Publish checklist</CardTitle>
        <ul className="mb-4 space-y-1.5 text-sm text-ink/75">
          <li>{p.description.length >= 50 ? "✓" : "○"} Description of at least 50 characters</li>
          <li>{images.length ? "✓" : "○"} At least one photograph</li>
          <li>{pr.address_line && pr.contact_phone ? "✓" : "○"} Private address and contact phone</li>
          <li>{p.terms_accepted_at ? "✓" : "○"} Host terms accepted</li>
        </ul>
        {canSubmit ? <SubmitForReviewForm propertyId={p.id} label={p.status === "rejected" ? "Resubmit for review" : "Submit for review"} /> : <p className="text-sm text-ink/60">Last updated {formatDateTime(p.updated_at)}.</p>}
      </Card>

      <section aria-labelledby="photos">
        <h2 id="photos" className="mb-4 font-display text-2xl text-forest-950">Photographs</h2>
        <PhotoManager propertyId={p.id} images={images.map((i) => ({ id: i.id, path: i.path, source: i.source, alt: i.alt }))} editable={p.status !== "suspended"} />
      </section>

      <section aria-labelledby="rooms">
        <h2 id="rooms" className="mb-4 font-display text-2xl text-forest-950">Room types</h2>
        <Card>
          {roomList.length ? (
            <ul className="mb-6 divide-y divide-forest-900/8">
              {roomList.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span><strong className="text-forest-950">{r.name}</strong> · sleeps {r.capacity} · {r.quantity} room{r.quantity === 1 ? "" : "s"}{r.price_inr !== null ? ` · ${formatINR(r.price_inr)}` : ""}</span>
                  <form action={deleteRoomType.bind(null, r.id, p.id)}><button type="submit" className="text-red-700 underline underline-offset-2">Remove</button></form>
                </li>
              ))}
            </ul>
          ) : <p className="mb-5 text-sm text-ink/55">No room types listed. Add them if you have different room options.</p>}
          <AddRoomTypeForm propertyId={p.id} />
        </Card>
      </section>

      <section aria-labelledby="details">
        <h2 id="details" className="mb-4 font-display text-2xl text-forest-950">Listing details</h2>
        <PropertyForm
          catalog={catalog}
          initial={{
            id: p.id, name: p.name, category_id: p.category_id, summary: p.summary, description: p.description,
            city: p.city, state: p.state, region: p.region, postal_code: p.postal_code, rooms_count: p.rooms_count,
            max_guests: p.max_guests, price_inr: p.price_inr, price_unit: p.price_unit, check_in_time: p.check_in_time,
            check_out_time: p.check_out_time, house_rules: p.house_rules, cancellation_policy: p.cancellation_policy,
            amenity_ids: (am.data ?? []).map((r) => r.amenity_id as number), experience_ids: (ex.data ?? []).map((r) => r.experience_id as number),
            address_line: pr.address_line, contact_name: pr.contact_name, contact_email: pr.contact_email, contact_phone: pr.contact_phone,
            current_platforms: pr.current_platforms, partnership_model: pr.partnership_model, terms_accepted: Boolean(p.terms_accepted_at),
          }}
          readOnlyNotice={p.status === "suspended" ? "This listing is suspended. You can review it, but it will not be visible until an administrator reinstates it." : undefined}
        />
      </section>

      {p.status === "draft" ? (
        <Card className="border-red-200"><CardTitle>Delete draft</CardTitle><p className="mb-3 text-sm text-ink/65">Permanently removes this draft and its photographs. Only drafts can be deleted.</p><DeleteDraftForm propertyId={p.id} /></Card>
      ) : null}
    </div>
  );
}
