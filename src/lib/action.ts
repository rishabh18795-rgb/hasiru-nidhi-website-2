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
  [/orders_closed/, "Ordering is not open yet."],
  [/insufficient_stock: ?(\d+)/, "That is more than the seller has in stock."],
  [/out_of_stock: ?(.*)/, "One item is out of stock. Please review your cart."],
  [/not_deliverable: ?(.*)/, "One seller does not deliver to this PIN code. Choose another address or remove that seller's items."],
  [/product_unavailable/, "That product is no longer available."],
  [/product_paused/, "That product is currently unavailable."],
  [/own_product/, "You can't buy your own product."],
  [/cart_full/, "Your cart can hold at most 50 different items."],
  [/cart_empty/, "Your cart is empty."],
  [/address_required/, "Choose a delivery address."],
  [/address_incomplete/, "Please fill in the name, phone, address line, city and state."],
  [/too_many_addresses/, "You can save at most 10 addresses."],
  [/invalid_key/, "Please reload the page and try again."],
  [/tracking_required/, "Enter the carrier and a tracking number."],
  [/not_delivered/, "Returns and replacements can be requested after the order is delivered."],
  [/cannot_cancel/, "This order can no longer be cancelled."],
  [/not_allowed_by_policy: ?(.*)/, "This type of request isn't allowed for the product category."],
  [/window_expired: ?(.*)/, "The request window for this product category has passed."],
  [/services_closed/, "Services are not open yet."],
  [/service_unavailable/, "This provider is not taking new requests for this service right now."],
  [/own_service/, "You can't request your own service."],
  [/outside_service_area/, "This provider does not serve that PIN code. Try another provider or a different address."],
  [/invalid_phone/, "Enter a valid phone number the provider can reach you on."],
  [/details_required/, "Describe the work you need (at least 10 characters) so the provider can quote for it."],
  [/slot_unavailable/, "That time is not available. Please choose a different time."],
  [/invalid_slot/, "Choose a time in the future."],
  [/too_many_open_requests/, "You have many open requests. Please wait for providers to respond or cancel some first."],
  [/quotation_required/, "This is a quotation-based service: send a quotation first."],
  [/not_quotation_based/, "This service has a fixed price: accept it instead of sending a quotation."],
  [/quotation_expired/, "This quotation has expired. Ask the provider for a new one."],
  [/provider_unavailable/, "This provider is not available right now."],
  [/invalid_validity/, "Choose a quotation expiry date between today and 180 days from now."],
  [/description_required/, "Describe what the quotation covers (at least 10 characters)."],
  [/invalid_pricing/, "Choose fixed price or quotation on request."],
  [/invalid_price_unit/, "Choose what the price is per (visit, hour, day, sq ft, plant, session or job)."],
  [/invalid_duration/, "Enter a duration between 15 minutes and 8 hours."],
  [/invalid_decision/, "Choose accept or decline."],
  [/invalid_availability/, "Check your weekly hours: each day needs a start and a later end time."],
  [/overlapping_availability/, "Two time windows on the same day overlap."],
  [/invalid_dates/, "Please choose valid dates."],
  [/too_many_items/, "You have reached the limit for days off."],
  [/service_locked_in_review/, "This service is being reviewed, so it can't be edited right now."],
  [/service_locked/, "This service can't be changed in its current state."],
  [/payment_not_configured/, "Payment is not configured yet."],
  [/duplicate key|unique constraint/, "You already have an open request of that kind for this order."],
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
  const stockN = raw.match(/insufficient_stock: ?(\d+)/);
  if (stockN) return `Only ${stockN[1]} available.`;
  const oos = raw.match(/out_of_stock: ?(.*)/);
  if (oos) return `${oos[1]} is out of stock. Please update your cart.`;
  const nd = raw.match(/not_deliverable: ?(.*)/);
  if (nd) return `${nd[1]} does not deliver to this PIN code. Choose another address or remove that seller's items.`;
  const pol = raw.match(/not_allowed_by_policy: ?(.*)/);
  if (pol) return `Our policy for ${pol[1]} does not allow this request.`;
  const win = raw.match(/window_expired: ?(.*)/);
  if (win) return `The request window for ${win[1]} has passed.`;
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
  const svc = raw.match(/incomplete_service: ?(.*)/);
  if (svc) {
    const names: Record<string, string> = { name: "a name", description: "a description of at least 30 characters", images: "at least one photo", service_areas: "your service PIN codes (Delivery & service areas)" };
    return `Before submitting, please add: ${svc[1].split(",").map((k) => names[k] ?? k).join("; ")}.`;
  }
  const stay = raw.match(/invalid_stay_length:(\d+)-(\d+)/);
  if (stay) return `This property accepts stays of ${stay[1]} to ${stay[2]} nights. Please adjust your dates.`;
  for (const [pattern, message] of FRIENDLY) {
    if (pattern.test(raw) || (error?.code && pattern.test(error.code))) return message;
  }
  return "Something went wrong. Please try again, or contact support if it keeps happening.";
}
