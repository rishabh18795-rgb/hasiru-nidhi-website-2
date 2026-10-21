import type { Property, PropertyPrivate } from "@/lib/db/types";
import type { WizardStepKey } from "@/lib/wizard/steps";

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  /** The wizard step where it can be fixed. */
  step: WizardStepKey;
}

type PropertyFields = Pick<
  Property,
  | "name" | "category_id" | "city" | "state" | "country" | "description" | "max_guests" | "rooms_count"
  | "bedrooms" | "beds" | "bathrooms" | "accommodation_arrangement" | "price_inr" | "cancellation_policy"
  | "terms_accepted_at" | "photo_rights_confirmed_at"
>;

/**
 * What a listing needs before it can be submitted for review. The database enforces its own minimum inside
 * submit_property(); this list is the (slightly stricter) wizard standard shown to the host.
 */
export function listingChecklist(p: PropertyFields, priv: Partial<PropertyPrivate> | null, imageCount: number): ChecklistItem[] {
  const filled = (v: string | null | undefined) => Boolean(v && v.trim());
  return [
    { key: "name", label: "Property name", ok: p.name.trim().length >= 3, step: "type" },
    { key: "category", label: "Property type", ok: p.category_id !== null, step: "type" },
    { key: "place", label: "City, state and country", ok: filled(p.city) && filled(p.state) && filled(p.country), step: "location" },
    { key: "address", label: "Full address (kept private)", ok: filled(priv?.address_line), step: "location" },
    { key: "description", label: "Description of at least 50 characters", ok: p.description.trim().length >= 50, step: "details" },
    { key: "rooms", label: "Rooms, beds, bathrooms and arrangement", ok: p.bedrooms !== null && p.beds !== null && p.bathrooms !== null && p.accommodation_arrangement !== null, step: "details" },
    { key: "photos", label: "At least one photograph", ok: imageCount >= 1, step: "photos" },
    { key: "price", label: "Price per night or per guest", ok: p.price_inr !== null, step: "pricing" },
    { key: "contact", label: "Contact person and phone (kept private)", ok: filled(priv?.contact_name) && filled(priv?.contact_phone), step: "review" },
    { key: "terms", label: "Host terms accepted", ok: p.terms_accepted_at !== null, step: "review" },
    { key: "rights", label: "Photograph rights confirmed", ok: p.photo_rights_confirmed_at !== null, step: "review" },
  ];
}

export const isComplete = (items: ChecklistItem[]) => items.every((i) => i.ok);

/** Shown as advice, never blocks submission. */
export const RECOMMENDED_PHOTOS = 5;
