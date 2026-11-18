import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { AddRoomTypeForm, SubmitForReviewForm } from "@/components/host/host-forms";
import { AvailabilityPanel } from "@/components/host/availability-panel";
import { ListingPreview } from "@/components/host/wizard/listing-preview";
import { PhotoUploader } from "@/components/host/wizard/photo-uploader";
import { AmenitiesStep, DetailsStep, LocationStep, PoliciesStep, PricingStep, TypeStep, type StepInitial } from "@/components/host/wizard/step-forms";
import { WizardProgress } from "@/components/host/wizard/wizard-progress";
import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/data/catalog";
import { loadHostListing, type HostListing } from "@/lib/data/host-listing";
import { deleteRoomType } from "@/app/host/actions";
import { formatINR } from "@/lib/format";
import { isComplete, listingChecklist, RECOMMENDED_PHOTOS } from "@/lib/wizard/checklist";
import { WIZARD_STEPS, isStepKey, nextStep, previousStep, wizardPath, type WizardStepKey } from "@/lib/wizard/steps";

export const metadata: Metadata = { title: "Listing wizard" };

const LOCKED: Record<string, string> = {
  pending_review: "This listing is awaiting review, so it can't be edited until an administrator has decided. You'll be notified.",
  suspended: "This listing has been suspended by an administrator and can't be edited. Please contact support.",
};

function initialFor(step: WizardStepKey, l: HostListing): StepInitial {
  const p = l.property;
  switch (step) {
    case "type": return { name: p.name, category_id: p.category_id };
    case "location": return {
      country: p.country, state: p.state, city: p.city, region: p.region, postal_code: p.postal_code, address_line: l.priv.address_line,
      latitude: l.priv.exact_latitude ?? p.latitude, longitude: l.priv.exact_longitude ?? p.longitude, location_precision: p.location_precision,
    };
    case "details": return {
      summary: p.summary, description: p.description, rooms_count: p.rooms_count, max_guests: p.max_guests, bedrooms: p.bedrooms, beds: p.beds,
      bathrooms: p.bathrooms, accommodation_arrangement: p.accommodation_arrangement, check_in_time: p.check_in_time, check_out_time: p.check_out_time, house_rules: p.house_rules,
    };
    case "amenities": return { amenity_ids: l.amenityIds, experience_ids: l.experienceIds };
    case "pricing": return {
      price_unit: p.price_unit === "per_person_night" ? "per_person_night" : "per_night", price_inr: p.price_inr, weekend_price_inr: p.weekend_price_inr,
      included_guests: p.included_guests, extra_guest_fee_inr: p.extra_guest_fee_inr, cleaning_fee_inr: p.cleaning_fee_inr,
      tax_percent: p.tax_percent, min_nights: p.min_nights, max_nights: p.max_nights,
    };
    case "review": return {
      cancellation_policy: p.cancellation_policy, contact_name: l.priv.contact_name, contact_phone: l.priv.contact_phone, contact_email: l.priv.contact_email,
      current_platforms: l.priv.current_platforms, partnership_model: l.priv.partnership_model,
      accept_terms: p.terms_accepted_at ? 1 : 0, accept_photo_rights: p.photo_rights_confirmed_at ? 1 : 0,
    };
    default: return {};
  }
}

function NavLinks({ id, step }: { id: string; step: WizardStepKey }) {
  const prev = previousStep(step);
  const next = nextStep(step);
  const base = "inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-forest-900/10 pt-5">
      {prev ? <Link href={wizardPath(id, prev)} className={`${base} border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50`}>Back</Link> : <span />}
      {next ? <Link href={wizardPath(id, next)} className={`${base} bg-forest-800 text-cream hover:bg-forest-700`}>Continue</Link> : null}
    </div>
  );
}

export default async function WizardStepPage({ params, searchParams }: { params: Promise<{ id: string; step: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id, step } = await params;
  const sp = await searchParams;
  if (!isStepKey(step)) notFound();
  const { supabase, user } = await requireRole(["host"], `/host/properties/${id}/wizard/${step}`);
  const listing = await loadHostListing(supabase, id, user.id);
  if (!listing) notFound();
  const { property: p } = listing;
  const catalog = step === "type" || step === "amenities" ? await getCatalog() : { categories: [], amenities: [], experiences: [] };
  const locked = LOCKED[p.status];
  const meta = WIZARD_STEPS.find((s) => s.key === step)!;
  const checklist = listingChecklist(p, listing.priv, listing.images.length);
  const initial = initialFor(step, listing);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/host/properties/${id}`} className="text-sm text-forest-700 underline">← {p.name}</Link>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">{meta.label}</h1>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <WizardProgress propertyId={id} current={step} />

      {sp.saved ? <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Draft saved.</p> : null}
      {locked ? <p role="status" className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">{locked}</p> : null}
      {p.status === "approved" ? <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">This listing is live. Changing its name, description, type or location sends it back for review; other changes apply immediately.</p> : null}
      {p.status === "rejected" && p.rejection_reason ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><strong>{p.review_kind === "changes_requested" ? "Changes requested" : "Not approved"}:</strong> {p.rejection_reason}</p>
      ) : null}

      {locked ? <ListingPreview listing={listing} editable={false} /> : (
        <>
          {step === "type" ? <TypeStep propertyId={id} initial={initial} catalog={catalog} /> : null}
          {step === "location" ? <LocationStep propertyId={id} initial={initial} /> : null}
          {step === "details" ? (
            <>
              <DetailsStep propertyId={id} initial={initial} />
              <section aria-labelledby="rooms">
                <h2 id="rooms" className="mb-3 font-display text-2xl text-forest-950">Room types (optional)</h2>
                <Card>
                  {listing.rooms.length ? (
                    <ul className="mb-6 divide-y divide-forest-900/8">
                      {listing.rooms.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <span><strong className="text-forest-950">{r.name}</strong> · sleeps {r.capacity} · {r.quantity} room{r.quantity === 1 ? "" : "s"}{r.price_inr !== null ? ` · ${formatINR(r.price_inr)}` : ""}</span>
                          <form action={deleteRoomType.bind(null, r.id, p.id)}><button type="submit" className="text-red-700 underline underline-offset-2">Remove</button></form>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mb-5 text-sm text-ink/55">No room types listed. Add them if you offer different kinds of room.</p>}
                  <AddRoomTypeForm propertyId={p.id} />
                  <p className="mt-3 text-xs text-ink/55">Room types describe what you offer. Booking prices come from the Pricing step; each confirmed booking reserves the whole property.</p>
                </Card>
              </section>
            </>
          ) : null}
          {step === "photos" ? (
            <>
              <Card>
                <CardTitle>Your photographs</CardTitle>
                <PhotoUploader propertyId={id} images={listing.images.map((i) => ({ id: i.id, path: i.path, source: i.source, alt: i.alt }))} editable />
                <p className="mt-4 text-sm text-ink/60">{listing.images.length === 0 ? `Add at least one photograph (we recommend ${RECOMMENDED_PHOTOS} or more) before submitting.` : `${listing.images.length} saved.${listing.images.length < RECOMMENDED_PHOTOS ? ` We recommend at least ${RECOMMENDED_PHOTOS}.` : ""}`}</p>
              </Card>
              <NavLinks id={id} step={step} />
            </>
          ) : null}
          {step === "amenities" ? <AmenitiesStep propertyId={id} initial={initial} catalog={catalog} /> : null}
          {step === "pricing" ? <PricingStep propertyId={id} initial={initial} maxGuests={p.max_guests} /> : null}
          {step === "availability" ? (
            <>
              <AvailabilityPanel supabase={supabase} propertyId={id} />
              <NavLinks id={id} step={step} />
            </>
          ) : null}
          {step === "review" ? (
            <>
              <PoliciesStep propertyId={id} initial={initial} />
              <section aria-labelledby="preview" className="space-y-4">
                <h2 id="preview" className="font-display text-2xl text-forest-950">Preview your listing</h2>
                <p className="text-sm text-ink/65">This is how travellers will see it once approved. Use any Edit link to change a section.</p>
                <ListingPreview listing={listing} />
              </section>
              <Card id="submit">
                <CardTitle>{p.status === "approved" ? "Your listing is live" : p.status === "rejected" ? "Resubmit for review" : "Submit for review"}</CardTitle>
                <ul className="mb-5 space-y-2 text-sm">
                  {checklist.map((c) => (
                    <li key={c.key} className="flex items-center gap-2">
                      <span aria-hidden="true" className={c.ok ? "text-forest-700" : "text-red-600"}>{c.ok ? "✓" : "○"}</span>
                      <span className={c.ok ? "text-ink/75" : "text-red-700"}>{c.label}{c.ok ? "" : " — "}{c.ok ? null : <Link href={wizardPath(id, c.step)} className="underline">fix</Link>}</span>
                    </li>
                  ))}
                </ul>
                {p.status === "approved" ? <p className="text-sm text-ink/65">Nothing more to submit. <Link href={`/stays/${p.slug}`} className="underline">View the live page</Link>.</p>
                  : isComplete(checklist) ? <SubmitForReviewForm propertyId={id} label={p.status === "rejected" ? "Resubmit for review" : "Submit for review"} />
                  : <p className="text-sm text-ink/65">Complete the items above to submit. Your progress is saved.</p>}
              </Card>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
