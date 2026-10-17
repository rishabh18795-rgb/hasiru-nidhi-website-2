import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BedDouble, Check, Clock, Heart, MapPin, MessageCircle, ShieldCheck, Star, Users } from "lucide-react";

import { SampleBadge } from "@/components/app/ui";
import { AvailabilityCalendar } from "@/components/stays/availability-calendar";
import { BookingPanel } from "@/components/stays/booking-panel";
import { StayCard } from "@/components/stays/stay-card";
import { ContactHostForm, ReportForm } from "@/components/stays/stay-forms";
import { StayGallery } from "@/components/stays/stay-gallery";
import { getSession } from "@/lib/auth";
import { getPublicSettings } from "@/lib/data/catalog";
import { getSimilarStays, getStayBySlug } from "@/lib/data/stays";
import { whatsappLink, whatsappMessage } from "@/lib/contact";
import { formatDate, formatINR, PRICE_UNIT_LABEL } from "@/lib/format";
import { FALLBACK_PROPERTY_IMAGE, propertyImageUrl } from "@/lib/images";
import { todayIST } from "@/lib/stays/filters";
import { cancellationPolicies } from "@/lib/validation/property";
import { siteConfig } from "@/lib/site";
import { toggleSaved } from "@/app/stays/actions";

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const stay = await getStayBySlug(slug);
  if (!stay) return { title: "Stay not found", robots: { index: false } };
  const p = stay.property;
  const cover = stay.images[0] ? propertyImageUrl(stay.images[0].path, stay.images[0].source) : null;
  return {
    title: `${p.name} — ${[p.city, p.state].filter(Boolean).join(", ")}`,
    description: p.summary || p.description.slice(0, 155),
    alternates: { canonical: `/stays/${p.slug}` },
    // Demonstration listings must never be indexed.
    robots: p.is_sample ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: cover ? { images: [{ url: cover }] } : undefined,
  };
}

export default async function StayPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const sp = await searchParams;
  const stay = await getStayBySlug(slug);
  if (!stay) notFound();
  const { property: p } = stay;

  const [session, settings, similar] = await Promise.all([getSession(), getPublicSettings(), getSimilarStays(p)]);
  const viewer = !session ? "anonymous" : p.host_id === session.user.id ? "owner" : "traveller";
  let saved = false;
  if (session) {
    const { data } = await session.supabase.from("saved_properties").select("property_id").eq("user_id", session.user.id).eq("property_id", p.id).maybeSingle();
    saved = Boolean(data);
  }

  const images = stay.images.length
    ? stay.images.map((i) => ({ src: propertyImageUrl(i.path, i.source) ?? FALLBACK_PROPERTY_IMAGE, alt: i.alt || `${p.name} photo` }))
    : [{ src: FALLBACK_PROPERTY_IMAGE, alt: `${p.name} (illustrative image)` }];
  const location = [p.city, p.region && p.region !== p.city ? p.region : null, p.state].filter(Boolean).join(", ");
  const policy = cancellationPolicies.find((c) => c.value === p.cancellation_policy);
  const wa = whatsappLink(settings.whatsapp_number, whatsappMessage("property", p.name));
  const grouped = stay.amenities.reduce<Record<string, typeof stay.amenities>>((acc, a) => {
    (acc[a.group_name] ??= []).push(a);
    return acc;
  }, {});
  const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const jsonLd = p.is_sample
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "LodgingBusiness",
        name: p.name,
        description: p.summary || p.description.slice(0, 300),
        url: `${siteConfig.url}/stays/${p.slug}`,
        image: images.map((i) => i.src),
        address: { "@type": "PostalAddress", addressLocality: p.city, addressRegion: p.state, addressCountry: "IN" },
        ...(p.price_inr !== null ? { priceRange: `₹${p.price_inr}` } : {}),
        // Rating markup only when genuine verified-stay reviews exist.
        ...(stay.reviews.length > 0 && stay.ratingAverage
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stay.ratingAverage.toFixed(1), reviewCount: stay.reviews.length } }
          : {}),
      };

  return (
    <article className="bg-cream pb-24 pt-28">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
      <div className="container-nidhi">
        <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink/55">
          <Link href="/" className="hover:text-forest-900">Home</Link> / <Link href="/stays" className="hover:text-forest-900">Stays</Link> / <span className="text-ink/80">{p.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {p.is_sample ? <SampleBadge /> : null}
              {stay.category ? <span className="text-eyebrow">{stay.category.name}</span> : null}
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-forest-950 sm:text-5xl">{p.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/65">
              {location ? <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" /> {location}</span> : null}
              {stay.ratingAverage ? <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-sand-500 text-sand-500" aria-hidden="true" /> {stay.ratingAverage.toFixed(1)} · {stay.reviews.length} verified-stay review{stay.reviews.length === 1 ? "" : "s"}</span> : null}
            </p>
          </div>
          {session ? (
            <form action={toggleSaved.bind(null, p.id, p.slug)}>
              <button type="submit" aria-pressed={saved} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-900/20 bg-white px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">
                <Heart className={`h-4 w-4 ${saved ? "fill-red-500 text-red-500" : ""}`} aria-hidden="true" />
                {saved ? "Saved" : "Save"}
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-6"><StayGallery images={images} name={p.name} /></div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-12">
            <section aria-labelledby="about">
              <h2 id="about" className="font-display text-2xl text-forest-950">About this stay</h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/75">
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-forest-600" aria-hidden="true" /> Up to {p.max_guests} guests</li>
                <li className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-forest-600" aria-hidden="true" /> {p.rooms_count} room{p.rooms_count === 1 ? "" : "s"}</li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-forest-600" aria-hidden="true" /> Check-in {p.check_in_time.slice(0, 5)} · Check-out {p.check_out_time.slice(0, 5)}</li>
              </ul>
              <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-ink/80">{p.description}</p>
            </section>

            {stay.host ? (
              <section aria-labelledby="host" className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/10">
                <h2 id="host" className="font-display text-xl text-forest-950">Hosted by {stay.host.full_name || "the property owner"}</h2>
                <p className="mt-2 flex items-center gap-2 text-sm text-ink/70">
                  {stay.host.host_verified ? <><ShieldCheck className="h-4 w-4 text-forest-600" aria-hidden="true" /> Identity and listing verified by Hasiru Nidhi</> : "Not yet verified by Hasiru Nidhi"}
                </p>
              </section>
            ) : (
              <section aria-labelledby="host" className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/10">
                <h2 id="host" className="font-display text-xl text-forest-950">Managed by Hasiru Nidhi</h2>
                <p className="mt-2 text-sm text-ink/70">This listing is operated directly by the Hasiru Nidhi team.</p>
              </section>
            )}

            {stay.rooms.length ? (
              <section aria-labelledby="rooms">
                <h2 id="rooms" className="font-display text-2xl text-forest-950">Rooms</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {stay.rooms.map((r) => (
                    <li key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-forest-900/10">
                      <p className="font-medium text-forest-950">{r.name}</p>
                      <p className="mt-1 text-sm text-ink/65">Sleeps {r.capacity} · {r.quantity} available{r.price_inr !== null ? ` · ${formatINR(r.price_inr)}` : ""}</p>
                      {r.description ? <p className="mt-2 text-sm text-ink/60">{r.description}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {stay.amenities.length ? (
              <section aria-labelledby="amenities">
                <h2 id="amenities" className="font-display text-2xl text-forest-950">Facilities</h2>
                <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {Object.entries(grouped).map(([group, items]) => (
                    <div key={group}>
                      <p className="text-eyebrow mb-2 capitalize">{group}</p>
                      <ul className="space-y-1.5">
                        {items.map((a) => <li key={a.id} className="flex items-center gap-2 text-sm text-ink/80"><Check className="h-4 w-4 text-forest-600" aria-hidden="true" />{a.name}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {stay.experiences.length ? (
              <section aria-labelledby="experiences">
                <h2 id="experiences" className="font-display text-2xl text-forest-950">Experiences &amp; activities</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {stay.experiences.map((e) => <li key={e.id} className="rounded-full bg-forest-50 px-4 py-1.5 text-sm text-forest-800">{e.name}</li>)}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="availability">
              <h2 id="availability" className="font-display text-2xl text-forest-950">Availability</h2>
              <div className="mt-4"><AvailabilityCalendar ranges={stay.unavailable} /></div>
            </section>

            <section aria-labelledby="policies">
              <h2 id="policies" className="font-display text-2xl text-forest-950">Good to know</h2>
              <dl className="mt-4 space-y-5 text-sm">
                <div>
                  <dt className="font-medium text-forest-950">Cancellation policy</dt>
                  <dd className="mt-1 text-ink/75">{policy?.label}. <Link href="/cancellation-policy" className="underline">How refunds work</Link></dd>
                </div>
                <div>
                  <dt className="font-medium text-forest-950">House rules</dt>
                  <dd className="mt-1 whitespace-pre-line text-ink/75">{p.house_rules || "The host hasn't listed specific house rules."}</dd>
                </div>
                <div>
                  <dt className="font-medium text-forest-950">Approximate location</dt>
                  <dd className="mt-1 text-ink/75">{location || "Karnataka"}. The exact address is shared by the host after a booking is confirmed.</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="reviews">
              <h2 id="reviews" className="font-display text-2xl text-forest-950">Reviews</h2>
              {stay.reviews.length === 0 ? (
                <p className="mt-3 text-sm text-ink/60">No reviews yet. Only guests who have completed a confirmed stay can leave a review.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {stay.reviews.map((r) => (
                    <li key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-forest-900/10">
                      <p className="flex items-center gap-1 text-sm" aria-label={`${r.rating} out of 5`}>
                        {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-sand-500 text-sand-500" : "text-ink/20"}`} aria-hidden="true" />)}
                        <span className="ml-2 text-xs text-ink/50">Verified stay · {formatDate(r.created_at)}</span>
                      </p>
                      {r.comment ? <p className="mt-2 text-sm text-ink/80">{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="contact" className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/10">
              <h2 id="contact" className="font-display text-xl text-forest-950">Questions about this stay?</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {wa ? (
                  <a href={wa} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-900/20 px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Ask on WhatsApp
                  </a>
                ) : null}
              </div>
              <details className="mt-4 group">
                <summary className="cursor-pointer text-sm font-medium text-forest-800 underline underline-offset-2">Send a message to the host / team</summary>
                <ContactHostForm propertyId={p.id} propertyName={p.name} />
              </details>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-ink/60 underline underline-offset-2">Report this listing</summary>
                <ReportForm propertyId={p.id} />
              </details>
            </section>
          </div>

          <aside>
            <BookingPanel
              propertyId={p.id}
              slug={p.slug}
              maxGuests={p.max_guests}
              price={p.price_inr}
              priceUnit={p.price_unit}
              minDate={todayIST()}
              initialCheckIn={firstParam(sp.checkin)}
              initialCheckOut={firstParam(sp.checkout)}
              initialGuests={Number(firstParam(sp.guests)) || undefined}
              viewer={viewer}
            />
            <p className="mt-3 px-2 text-xs text-ink/55">Price per unit: {p.price_inr !== null ? `${formatINR(p.price_inr)} ${PRICE_UNIT_LABEL[p.price_unit]}` : "set by the host on request"}.</p>
          </aside>
        </div>

        {similar.length ? (
          <section aria-labelledby="similar" className="mt-20">
            <h2 id="similar" className="font-display text-2xl text-forest-950">Similar stays</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <StayCard key={s.id} stay={s} />)}</div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
