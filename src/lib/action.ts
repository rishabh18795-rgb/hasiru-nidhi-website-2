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
};

/** Translate database / RPC errors into messages that are safe and useful to show users. */
export function friendlyDbError(error: { message?: string; code?: string } | null | undefined): string {
  const raw = error?.message ?? "";
  const incomplete = raw.match(/incomplete_listing: ?([a-z_,]+)/);
  if (incomplete) {
    const missing = incomplete[1].split(",").map((k) => LABELS[k] ?? k);
    return `Before submitting, please add: ${missing.join("; ")}.`;
  }
  const stay = raw.match(/invalid_stay_length:(\d+)-(\d+)/);
  if (stay) return `This property accepts stays of ${stay[1]} to ${stay[2]} nights. Please adjust your dates.`;
  for (const [pattern, message] of FRIENDLY) {
    if (pattern.test(raw) || (error?.code && pattern.test(error.code))) return message;
  }
  return "Something went wrong. Please try again, or contact support if it keeps happening.";
}
