import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";

import type { HostListing } from "@/lib/data/host-listing";
import { formatINR, PRICE_UNIT_LABEL } from "@/lib/format";
import { propertyImageUrl } from "@/lib/images";
import { quoteLines, quoteStay } from "@/lib/pricing";
import { ARRANGEMENTS, cancellationOptions } from "@/lib/wizard/schemas";
import { wizardPath, type WizardStepKey } from "@/lib/wizard/steps";

function Block({ title, children, edit }: { title: string; children: React.ReactNode; edit?: { href: string } }) {
  return (
    <section className="rounded-2xl border border-forest-900/10 bg-white p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-forest-950">{title}</h3>
        {edit ? <Link href={edit.href} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-forest-800 hover:bg-forest-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit</Link> : null}
      </div>
      {children}
    </section>
  );
}

/** The listing exactly as a traveller will see it, with an Edit link on every section. */
export function ListingPreview({ listing, editable = true }: { listing: HostListing; editable?: boolean }) {
  const { property: p, priv, images, amenities, experiences, rooms, category } = listing;
  const step = (k: WizardStepKey) => (editable ? { href: wizardPath(p.id, k) } : undefined);
  const arrangement = ARRANGEMENTS.find((a) => a.value === p.accommodation_arrangement)?.label.split(" — ")[0];
  const cancellation = cancellationOptions.find((c) => c.value === p.cancellation_policy)?.label;
  const sample = quoteStay(p, "2030-01-07", "2030-01-09", Math.min(2, p.max_guests));
  const urls = images.map((i) => ({ i, url: propertyImageUrl(i.path, i.source) })).filter((x) => x.url);
  return (
    <div className="space-y-5">
      <Block title="Photographs" edit={step("photos")}>
        {urls.length === 0 ? <p className="text-sm text-red-700">No photographs yet.</p> : (
          <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
            {urls.slice(0, 5).map(({ i, url }, n) => (
              <div key={i.id} className={`relative overflow-hidden rounded-xl bg-forest-50 ${n === 0 ? "aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto" : "aspect-[4/3]"}`}>
                <Image src={url!} alt={i.alt || p.name} fill sizes="(min-width: 640px) 25vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
        )}
        {urls.length > 5 ? <p className="mt-2 text-xs text-ink/55">+ {urls.length - 5} more photograph{urls.length - 5 === 1 ? "" : "s"}</p> : null}
      </Block>

      <Block title={p.name} edit={step("type")}>
        <p className="text-sm text-ink/70">{[category?.name, [p.city, p.state, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
        {p.summary ? <p className="mt-2 text-sm text-ink/80">{p.summary}</p> : null}
      </Block>

      <Block title="Location" edit={step("location")}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-ink/50">Shown to guests</dt><dd className="mt-0.5">{[p.region, p.city, p.state, p.postal_code && `PIN ${p.postal_code}`, p.country].filter(Boolean).join(", ") || "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink/50">Map pin</dt><dd className="mt-0.5">{p.latitude !== null ? (p.location_precision === "exact" ? "Exact location" : "Approximate area (about 1 km)") : "No map pin"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink/50">Private address (guests see it only after a confirmed booking)</dt><dd className="mt-0.5">{priv.address_line || "—"}</dd></div>
        </dl>
      </Block>

      <Block title="About the property" edit={step("details")}>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{p.description || "—"}</p>
        <p className="mt-4 text-sm text-ink/70">
          Up to {p.max_guests} guests · {p.rooms_count} room{p.rooms_count === 1 ? "" : "s"}
          {p.bedrooms !== null ? ` · ${p.bedrooms} bedroom${p.bedrooms === 1 ? "" : "s"}` : ""}
          {p.beds !== null ? ` · ${p.beds} bed${p.beds === 1 ? "" : "s"}` : ""}
          {p.bathrooms !== null ? ` · ${p.bathrooms} bathroom${p.bathrooms === 1 ? "" : "s"}` : ""}
          {arrangement ? ` · ${arrangement}` : ""}
        </p>
        <p className="mt-2 text-sm text-ink/70">Check-in from {p.check_in_time.slice(0, 5)} · check-out by {p.check_out_time.slice(0, 5)}</p>
        {p.house_rules ? <p className="mt-3 whitespace-pre-line rounded-xl bg-stone-50 px-4 py-3 text-sm text-ink/75"><span className="font-medium">House rules:</span> {p.house_rules}</p> : null}
        {rooms.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-ink/70">{rooms.map((r) => <li key={r.id}>{r.name} · sleeps {r.capacity} · {r.quantity} room{r.quantity === 1 ? "" : "s"}</li>)}</ul>
        ) : null}
      </Block>

      <Block title="Facilities & experiences" edit={step("amenities")}>
        {amenities.length + experiences.length === 0 ? <p className="text-sm text-ink/60">None selected.</p> : (
          <div className="flex flex-wrap gap-2">
            {amenities.map((a) => <span key={`a${a.id}`} className="rounded-full bg-forest-50 px-3 py-1 text-xs text-forest-900">{a.name}</span>)}
            {experiences.map((x) => <span key={`x${x.id}`} className="rounded-full bg-sand-100 px-3 py-1 text-xs text-earth-800">{x.name}</span>)}
          </div>
        )}
      </Block>

      <Block title="Pricing" edit={step("pricing")}>
        {p.price_inr === null ? <p className="text-sm text-red-700">No price set.</p> : (
          <>
            <p className="text-sm"><span className="font-display text-2xl text-forest-950">{formatINR(p.price_inr)}</span> <span className="text-ink/60">{PRICE_UNIT_LABEL[p.price_unit]}</span></p>
            <ul className="mt-2 space-y-0.5 text-sm text-ink/70">
              {p.weekend_price_inr !== null ? <li>Weekend (Fri/Sat) nights: {formatINR(p.weekend_price_inr)}</li> : null}
              {p.included_guests !== null && p.extra_guest_fee_inr !== null ? <li>Includes {p.included_guests} guest{p.included_guests === 1 ? "" : "s"}; {formatINR(p.extra_guest_fee_inr)} per extra guest, per night</li> : null}
              {p.cleaning_fee_inr ? <li>Cleaning fee: {formatINR(p.cleaning_fee_inr)} per stay</li> : null}
              {p.tax_percent ? <li>Taxes: {p.tax_percent}%</li> : null}
              <li>Stay length: {p.min_nights} to {p.max_nights} night{p.max_nights === 1 ? "" : "s"}</li>
            </ul>
            {sample ? (
              <div className="mt-4 rounded-xl bg-sand-50 p-4 text-sm">
                <p className="font-medium text-forest-950">Example: 2 weekday nights, {sample.guests} guest{sample.guests === 1 ? "" : "s"}</p>
                <dl className="mt-2 space-y-1 text-ink/75">{quoteLines(sample).map((l) => <div key={l.label} className="flex justify-between gap-3"><dt>{l.label}</dt><dd>{formatINR(l.amount)}</dd></div>)}</dl>
                <p className="mt-2 flex justify-between border-t border-sand-300 pt-2 font-semibold text-forest-950"><span>Total</span><span>{formatINR(sample.total)}</span></p>
              </div>
            ) : null}
          </>
        )}
      </Block>

      <Block title="Policies" edit={step("review")}>
        <p className="text-sm text-ink/75">Cancellation: {cancellation ?? "—"}</p>
        <p className="mt-1 text-sm text-ink/75">Private contact: {priv.contact_name || "—"} · {priv.contact_phone || "—"}</p>
      </Block>
    </div>
  );
}
