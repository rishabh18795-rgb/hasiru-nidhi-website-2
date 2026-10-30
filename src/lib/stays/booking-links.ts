/**
 * Links that carry a traveller's selection (dates and guests) so it survives a trip through sign-in or sign-up and they land back on the
 * same property with the same choices. Only same-site paths are ever produced (the sign-in action re-validates them as well).
 */
export interface BookingSelection {
  checkin?: string | null;
  checkout?: string | null;
  guests?: number | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function selectionQuery(sel: BookingSelection = {}): string {
  const p = new URLSearchParams();
  if (sel.checkin && ISO.test(sel.checkin) && sel.checkout && ISO.test(sel.checkout) && sel.checkout > sel.checkin) {
    p.set("checkin", sel.checkin);
    p.set("checkout", sel.checkout);
  }
  if (sel.guests && Number.isInteger(sel.guests) && sel.guests >= 1 && sel.guests <= 500) p.set("guests", String(sel.guests));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

/** The property page (or its demo twin) with the selection, scrolled to the booking panel. */
export function stayHref(slug: string, sel: BookingSelection = {}, base = "/stays"): string {
  return `${base}/${slug}${selectionQuery(sel)}#booking`;
}

/** Sign-in / sign-up URL that returns the visitor to the same property, dates and guests afterwards. */
export function authHrefForBooking(kind: "sign-in" | "sign-up", slug: string, sel: BookingSelection = {}): string {
  return `/${kind}?next=${encodeURIComponent(stayHref(slug, sel))}`;
}
