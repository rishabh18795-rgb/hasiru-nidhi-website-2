import { PageHero } from "@/components/site/page-hero";
import { LinkButton } from "@/components/site/link-button";
import { images } from "@/lib/content";

/** Shown on every Services URL while the module is OFF (or the backend is unavailable). Honest, with real alternatives. */
export function ServicesNotOpen() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Hasiru Nidhi Services are opening soon."
        description="We are verifying our first service providers and reviewing their listings. Nothing can be booked yet, and we will not show providers until they are real."
        image={images.gardeningTools}
        crumb="Services"
        primaryCta={{ label: "Send a gardening enquiry", href: "/gardening" }}
        secondaryCta={{ label: "Become a provider", href: "/become-a-vendor" }}
      />
      <section className="bg-cream py-20">
        <div className="container-nidhi max-w-3xl text-center">
          <p className="text-base leading-relaxed text-ink/70">Gardening and landscaping help from verified providers will appear here after launch. In the meantime our gardening team still takes enquiries, and nothing about that changes.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton href="/gardening#enquire" variant="outline" size="lg" className="rounded-full border-forest-800/25 px-7 text-forest-900 hover:bg-forest-900/5">Gardening enquiry</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
