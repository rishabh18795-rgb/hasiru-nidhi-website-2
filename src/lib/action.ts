import { z } from "zod";

/** Shape returned by every server action that backs a form. */
export interface FormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed back so inputs can keep what the user typed after a validation error. */
  values?: Record<string, string>;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

const FRIENDLY: Array<[RegExp, string]> = [
  [/not_authenticated/, "Please sign in to continue."],
  [/account_suspended/, "This account has been suspended. Please contact support."],
  [/property_unavailable/, "This property is not available for booking."],
  [/own_property/, "You cannot book your own property."],
  [/invalid_dates/, "Please choose valid dates: check-in must be today or later, check-out after check-in, and stays are limited to 30 nights."],
  [/invalid_guests/, "The guest count is not valid for this property's capacity."],
  [/dates_unavailable/, "Those dates are no longer available. Please choose different dates."],
  [/duplicate_request/, "You already have an open request for overlapping dates at this property."],
  [/invalid_status/, "This item can no longer be changed because its status has already moved on."],
  [/stay_already_started/, "A stay that has already started cannot be cancelled online."],
  [/reason_required/, "Please provide a reason."],
  [/blocks_confirmed_booking/, "Those dates overlap a confirmed booking and cannot be blocked."],
  [/incomplete_listing: ?(.*)/, "Your listing is not complete yet."],
  [/forbidden|permission denied|row-level security|42501/, "You do not have permission to do that."],
  [/too_many_photos/, "A listing can have at most 20 photographs."],
  [/violates check constraint/, "One of the values is outside the allowed range. Please check the highlighted fields."],
  [/not_found/, "We could not find that record."],
  [/invalid_setting/, "That value is not allowed. The commission must be between 0 and 50 %."],
  [/overpayment/, "That would be more than the booking total. Please check the amount."],
  [/invalid_payment/, "Enter a positive amount and the bank / UPI reference of the payment."],
  [/invalid_refund_amount/, "The refund is larger than what remains of that payment."],
  [/nothing_to_settle/, "There is nothing to settle for this host yet. Only completed, paid bookings can be settled."],
  [/invalid_transition/, "That settlement can't move to that status from where it is."],
  [/reference_required/, "Enter the bank transfer reference to mark a settlement as paid."],
  [/stay_not_finished/, "A stay can be marked completed only after its check-out date."],
  [/commission_snapshot_immutable/, "The commission on an existing booking can't be changed."],
  [/vendor_registration_closed/, "Vendor registration is not open yet."],
  [/vendor_locked_in_review/, "Your application is being reviewed, so it can't be edited right now."],
  [/business_name_required/, "Enter your business name."],
  [/invalid_pin: ?(\S+)/, "Enter PIN codes as 6 digits (or a 3-digit prefix for a whole area)."],
  [/invalid_pin/, "Enter a valid 6-digit PIN code."],
  [/invalid_business_type/, "Choose a business type from the list."],
  [/capability_required/, "Choose at least one thing you want to do on Hasiru Nidhi."],
  [/vendor_not_approved/, "Approve the vendor's business first; capabilities are approved separately."],
  [/too_many_documents/, "You can upload at most 30 documents."],
  [/too_many_areas/, "You can list at most 500 PIN codes or areas."],
  [/invalid_scope/, "Unknown coverage type."],
  [/capability_not_approved/, "Selling products needs approval first. Our team approves each part of the marketplace separately."],
  [/product_locked_in_review/, "This product is being reviewed, so it can't be edited right now."],
  [/product_locked/, "This product can't be changed in its current state."],
  [/name_required/, "Enter a name of at least 3 characters."],
  [/invalid_category/, "Choose a category from the list."],
  [/invalid_attributes/, "Specifications must be short label and value pairs (up to 20)."],
  [/invalid_sku/, "The SKU can use letters, numbers, dots, dashes and underscores (up to 40 characters)."],
  [/duplicate_sku/, "This product already has a variant with that SKU."],
  [/variant_name_required/, "Give the variant a name shoppers will see, for example \"250 g pack\"."],
  [/invalid_price/, "Enter a price in rupees, at least 0.01."],
  [/invalid_weight/, "Enter the weight in grams as a positive whole number."],
  [/invalid_options/, "Options must be short name and value pairs (up to 5)."],
  [/invalid_quantity/, "Enter a valid quantity. Stock can't go below zero."],
  [/inventory_not_tracked/, "Stock isn't tracked for this variant."],
  [/too_many_variants/, "A product can have at most 30 variants."],
  [/too_many_images/, "A product can have at most 10 photos."],
  [/last_image/, "A live product must keep at least one photo. Add the new photo first, then remove the old one."],
  [/invalid_order/, "That order isn't valid. Please refresh and try again."],
  [/slug_immutable/, "A category's web address can't be changed."],
];

const LABELS: Record<string, string> = {
  name: "a property name",
  category: "a category",
  city: "a city",
  state: "a state",
  description: "a description of at least 50 characters",
  terms: "acceptance of the host terms",
  photos: "at least one photograph",
  contact_and_address: "a contact phone number and street address",
  pin_code: "a valid 6-digit PIN code",
};

/** Translate database / RPC errors into messages that are safe and useful to show users. */
export function friendlyDbError(error: { message?: string; code?: string } | null | undefined): string {
  const raw = error?.message ?? "";
  const incomplete = raw.match(/incomplete_listing: ?([a-z_,]+)/);
  if (incomplete) {
    const missing = incomplete[1].split(",").map((k) => LABELS[k] ?? k);
    return `Before submitting, please add: ${missing.join("; ")}.`;
  }
  const product = raw.match(/incomplete_product: ?(.*)/);
  if (product) {
    const names: Record<string, string> = { name: "a name", description: "a description of at least 30 characters", images: "at least one photo", variants: "at least one variant with a price", delivery_areas: "your delivery PIN codes (Delivery & service areas)" };
    return `Before submitting, please add: ${product[1].split(",").map((k) => names[k] ?? k).join("; ")}.`;
  }
  const vendor = raw.match(/incomplete_vendor: ?(.*)/);
  if (vendor) {
    const names: Record<string, string> = { contact_name: "a contact name", contact_phone: "a contact phone number", contact_email: "a contact email", address_line: "a business address", city: "a city", postal_code: "a 6-digit PIN code", business_type: "a business type" };
    const items = vendor[1].split(",").map((k) => (k.startsWith("document:") ? `the document "${k.slice(9)}"` : names[k] ?? k));
    return `Before submitting, please add: ${items.join("; ")}.`;
  }
  const stay = raw.match(/invalid_stay_length:(\d+)-(\d+)/);
  if (stay) return `This property accepts stays of ${stay[1]} to ${stay[2]} nights. Please adjust your dates.`;
  for (const [pattern, message] of FRIENDLY) {
    if (pattern.test(raw) || (error?.code && pattern.test(error.code))) return message;
  }
  return "Something went wrong. Please try again, or contact support if it keeps happening.";
}
