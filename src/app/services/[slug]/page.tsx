import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, Store } from "lucide-react";

import { ProductGallery } from "@/components/shop/product-gallery";
import { ServiceRequestForm } from "@/components/services/request-form";
import { ServicesNotOpen } from "@/components/services/service-notice";
import { getSession } from "@/lib/auth";
import { getMarketplaceFlags } from "@/lib/flags";
import { getPublicService, getServiceSlots } from "@/lib/data/services";
import { getPublicReviews } from "@/lib/data/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { serviceImageUrl } from "@/lib/images";
import { durationText, servicePriceText } from "@/lib/services";
import { siteConfig } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublicService(slug);
  if (!service) return { title: "Services", robots: { index: false, follow: true } };
  return {
    title: `${service.name}: ${service.category.name}`,
    description: (service.summary || service.description).slice(0, 155),
    alternates: { canonical: `/services/${service.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!(await getMarketplaceFlags()).services) return <ServicesNotOpen />;
  const service = await getPublicService(slug);
  if (!service) notFound();

  const session = await getSession();
  const reviews = await getPublicReviews("service", service.slug);
  const slots = service.has_availability && service.is_available ? await getServiceSlots(service.id) : [];
  const photos = service.images.map((i) => ({ src: serviceImageUrl(i.path) ?? "", alt: i.alt || service.name })).filter((i) => i.src);
  const fixed = service.pricing_model === "fixed";
  // Structured data only from facts we hold: name, description, photos, provider, and a real price when there is one.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.summary || service.description.slice(0, 300),
    image: photos.map((p) => p.src),
    category: service.category.name,
    provider: { "@type": "Organization", name: service.vendor.business_name },
    ...(fixed && service.price_inr !== null ? { offers: { "@type": "Offer", priceCurrency: "INR", price: Number(service.price_inr), url: `${siteConfig.url}/services/${service.slug}/` } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-cream pb-20 pt-32">
        <div className="container-nidhi">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink/65">
            <Link href="/services" className="hover:underline">Services</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link href={`/services?category=${service.category.slug}`} className="hover:underline">{service.category.name}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-current="page" className="text-ink/80">{service.name}</span>
          </nav>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              {photos.length ? <ProductGallery images={photos} name={service.name} /> : <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-forest-50 text-sm text-forest-800/60">The provider hasn&apos;t added a photo yet.</div>}
            </div>
            <div>
              <p className="text-eyebrow">{service.category.name}</p>
              <h1 className="mt-2 font-display text-3xl leading-tight text-forest-950 sm:text-4xl">{service.name}</h1>
              <p className="mt-2 text-sm text-ink/65">By <span className="font-medium text-forest-950">{service.vendor.business_name}</span>{service.vendor.city ? <> · {[service.vendor.city, service.vendor.state].filter(Boolean).join(", ")}</> : null}</p>
              {service.summary ? <p className="mt-4 text-base leading-relaxed text-ink/75">{service.summary}</p> : null}
              <p className="mt-5 font-display text-3xl text-forest-950" data-testid="service-price">{servicePriceText(service.pricing_model, service.price_inr, service.price_unit)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink/65"><span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />{durationText(service.duration_minutes)} per visit</span><span>{fixed ? "Taxes are not configured yet." : "The provider sends a quotation after hearing the details."}</span></p>
              {!service.is_available ? <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">This provider is not taking new requests for this service right now.</p> : (
                <div className="mt-6">
                  <ServiceRequestForm serviceId={service.id} serviceName={service.name} pricing={service.pricing_model} price={service.price_inr} unit={service.price_unit} slots={slots}
                    signedIn={Boolean(session && !session.profile.is_suspended && session.profile.role !== "admin")} signInHref={`/sign-in?next=${encodeURIComponent(`/services/${service.slug}`)}`} defaultName={session?.profile.full_name ?? ""} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-2xl text-forest-950">About this service</h2>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-ink/75">{service.description}</p>
              {service.attributes.length ? (
                <>
                  <h2 className="mt-8 font-display text-2xl text-forest-950">What is included</h2>
                  <dl className="mt-3 divide-y divide-forest-900/10 rounded-2xl border border-forest-900/10 bg-white text-sm">
                    {service.attributes.map((a) => <div key={a.label} className="grid grid-cols-[10rem_1fr] gap-3 px-4 py-3"><dt className="text-ink/65">{a.label}</dt><dd className="text-ink/85">{a.value}</dd></div>)}
                  </dl>
                </>
              ) : null}
              <div className="mt-10"><ReviewList reviews={reviews} noun="service" /></div>
            </div>
            <aside className="h-fit space-y-6">
              <div className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10">
                <h2 className="font-display text-xl text-forest-950">How it works</h2>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink/75">
                  <li>{fixed ? "Send a request with where and when." : "Describe the work and where it is."}</li>
                  <li>{fixed ? "The provider accepts and confirms the time." : "The provider sends a quotation. You accept or decline it."}</li>
                  <li>The provider does the work at the agreed time.</li>
                  <li>Payment is arranged directly with the provider. There is no online payment yet and nothing is charged here.</li>
                </ol>
              </div>
              <div className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10">
                <h2 className="flex items-center gap-2 font-display text-xl text-forest-950"><Store className="h-5 w-5" aria-hidden="true" /> About the provider</h2>
                <p className="mt-3 font-medium text-forest-950">{service.vendor.business_name}</p>
                {service.vendor.city ? <p className="text-sm text-ink/65">{[service.vendor.city, service.vendor.state].filter(Boolean).join(", ")}</p> : null}
                {service.vendor.description ? <p className="mt-3 text-sm leading-relaxed text-ink/70">{service.vendor.description}</p> : null}
                <p className="mt-3 text-xs text-ink/65">This provider has been verified by Hasiru Nidhi. They set their own prices and schedule.</p>
                <Link href={`/services?vendor=${service.vendor.slug}`} className="mt-4 inline-flex h-10 items-center rounded-full border border-forest-900/20 px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">More from this provider</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
