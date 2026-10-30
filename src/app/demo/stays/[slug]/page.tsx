import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BedDouble, Bath, Check, Clock, MapPin, Users } from "lucide-react";

import { SampleBadge } from "@/components/app/ui";
import { DemoModeBanner } from "@/components/stays/demo-mode";
import { DemoNotice } from "@/components/stays/demo-notice";
import { AvailabilityCalendar } from "@/components/stays/availability-calendar";
import { BookingPanel } from "@/components/stays/booking-panel";
import { StayGallery } from "@/components/stays/stay-gallery";
import { demoAmenityNames, demoExperienceNames, demoPricing, demoProperties, demoUnavailable, getDemoProperty } from "@/lib/demo/properties";
import { ARRANGEMENT_LABEL, CATEGORY_NAMES } from "@/lib/demo/vocabulary";
import { formatINR } from "@/lib/format";
import { propertyImageUrl } from "@/lib/images";
import { todayIST } from "@/lib/stays/filters";
import { cancellationPolicies } from "@/lib/validation/property";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return demoProperties.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = getDemoProperty((await params).slug);
  return { title: d ? `${d.name} — demo listing` : "Demo listing not found", robots: { index: false, follow: false } };
}

export default async function DemoStayPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const d = getDemoProperty((await params).slug);
  if (!d) notFound();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const today = todayIST();
  const images = d.images.map((i) => ({ src: propertyImageUrl(i.path, "static") ?? i.path, alt: i.alt }));
  const policy = cancellationPolicies.find((c) => c.value === d.cancellation_policy);
  const amenities = demoAmenityNames(d);
  const experiences = demoExperienceNames(d);
  const location = [d.city, d.region, d.state].filter(Boolean).join(", ");

  return (
    <>
      <div className="pt-20"><DemoModeBanner /></div>
      <article className="bg-cream pb-24 pt-8">
        <div className="container-nidhi">
          <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink/55">
            <Link href="/demo/stays" className="hover:text-forest-900">Demo stays</Link> / <span className="text-ink/80">{d.name}</span>
          </nav>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SampleBadge />
            <span className="text-eyebrow">{CATEGORY_NAMES[d.category]}</span>
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-forest-950 sm:text-5xl">{d.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink/65"><MapPin className="h-4 w-4" aria-hidden="true" /> {location}</p>
          <div className="mt-6"><DemoNotice /></div>
          <div className="mt-6"><StayGallery images={images} name={d.name} /></div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
            <div className="space-y-12">
              <section aria-labelledby="about">
                <h2 id="about" className="font-display text-2xl text-forest-950">About this stay</h2>
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/75">
                  <li className="flex items-center gap-2"><Users className="h-4 w-4 text-forest-600" aria-hidden="true" /> Up to {d.max_guests} guests</li>
                  <li className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-forest-600" aria-hidden="true" /> {d.bedrooms} bedroom{d.bedrooms === 1 ? "" : "s"} · {d.beds} bed{d.beds === 1 ? "" : "s"}</li>
                  <li className="flex items-center gap-2"><Bath className="h-4 w-4 text-forest-600" aria-hidden="true" /> {d.bathrooms} bathroom{d.bathrooms === 1 ? "" : "s"}</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-forest-600" aria-hidden="true" /> {ARRANGEMENT_LABEL[d.arrangement]}</li>
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-forest-600" aria-hidden="true" /> Check-in {d.check_in} · Check-out {d.check_out}</li>
                </ul>
                <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-ink/80">{d.description}</p>
              </section>

              <section aria-labelledby="amenities">
                <h2 id="amenities" className="font-display text-2xl text-forest-950">Amenities</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {amenities.map((a) => <li key={a} className="flex items-center gap-2 text-sm text-ink/80"><Check className="h-4 w-4 text-forest-600" aria-hidden="true" />{a}</li>)}
                </ul>
                <h3 className="mt-6 font-medium text-forest-950">Experiences</h3>
                <ul className="mt-3 flex flex-wrap gap-2">{experiences.map((e) => <li key={e} className="rounded-full bg-forest-50 px-4 py-1.5 text-sm text-forest-800">{e}</li>)}</ul>
              </section>

              <section aria-labelledby="prices">
                <h2 id="prices" className="font-display text-2xl text-forest-950">Prices <span className="text-sm font-normal text-amber-800">(illustrative demo values)</span></h2>
                <dl className="mt-4 space-y-2 text-sm text-ink/80">
                  <div className="flex justify-between gap-4"><dt>{d.price_unit === "per_person_night" ? "Per guest, per night" : "Per night"}</dt><dd>{formatINR(d.price_inr)}</dd></div>
                  {d.weekend_price_inr ? <div className="flex justify-between gap-4"><dt>Weekend nights (Fri &amp; Sat)</dt><dd>{formatINR(d.weekend_price_inr)}</dd></div> : null}
                  {d.included_guests && d.extra_guest_fee_inr ? <div className="flex justify-between gap-4"><dt>Each guest beyond {d.included_guests}, per night</dt><dd>{formatINR(d.extra_guest_fee_inr)}</dd></div> : null}
                  {d.cleaning_fee_inr ? <div className="flex justify-between gap-4"><dt>Cleaning fee (once)</dt><dd>{formatINR(d.cleaning_fee_inr)}</dd></div> : null}
                  <div className="flex justify-between gap-4"><dt>Stay length</dt><dd>{d.min_nights}–{d.max_nights} nights</dd></div>
                </dl>
              </section>

              <section aria-labelledby="availability">
                <h2 id="availability" className="font-display text-2xl text-forest-950">Availability</h2>
                <p className="mt-2 text-sm text-ink/60">Struck-through dates are blocked in this demo. Everything else is shown as open.</p>
                <div className="mt-4"><AvailabilityCalendar ranges={demoUnavailable(d, today)} /></div>
              </section>

              <section aria-labelledby="policies">
                <h2 id="policies" className="font-display text-2xl text-forest-950">Good to know</h2>
                <dl className="mt-4 space-y-5 text-sm">
                  <div><dt className="font-medium text-forest-950">House rules</dt><dd className="mt-1 text-ink/75">{d.house_rules}</dd></div>
                  <div><dt className="font-medium text-forest-950">Check-in and check-out</dt><dd className="mt-1 text-ink/75">Check-in from {d.check_in}; check-out by {d.check_out}.</dd></div>
                  <div><dt className="font-medium text-forest-950">Cancellation policy</dt><dd className="mt-1 text-ink/75">{policy?.label}</dd></div>
                  <div><dt className="font-medium text-forest-950">Location</dt><dd className="mt-1 text-ink/75">{location} — a demonstration location, not a real address.</dd></div>
                </dl>
              </section>
            </div>

            <aside>
              <BookingPanel
                viewer="demo" demoNotice propertyId={d.slug} slug={d.slug} maxGuests={d.max_guests} pricing={demoPricing(d)}
                minNights={d.min_nights} maxNights={d.max_nights} minDate={today}
                initialCheckIn={first(sp.checkin)} initialCheckOut={first(sp.checkout)} initialGuests={Number(first(sp.guests)) || undefined}
              />
            </aside>
          </div>
        </div>
      </article>
    </>
  );
}
