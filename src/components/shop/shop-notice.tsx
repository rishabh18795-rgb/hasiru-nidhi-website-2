import { PageHero } from "@/components/site/page-hero";
import { LinkButton } from "@/components/site/link-button";
import { images } from "@/lib/content";

/** Shown on every Shop URL while the module is OFF (or the backend is unavailable). Honest, with real alternatives. */
export function ShopNotOpen() {
  return (
    <>
      <PageHero
        eyebrow="Shop"
        title="The Hasiru Nidhi Shop is opening soon."
        description="We are verifying our first sellers and reviewing their products. Nothing is for sale yet, and we will not show products until they are real."
        image={images.gardeningTools}
        crumb="Shop"
        primaryCta={{ label: "Explore available stays", href: "/stays" }}
        secondaryCta={{ label: "Become a vendor", href: "/become-a-vendor" }}
      />
      <section className="bg-cream py-20">
        <div className="container-nidhi max-w-3xl text-center">
          <p className="text-base leading-relaxed text-ink/70">Plants, seeds, tools, organic fertilisers, handmade goods and farm produce from verified sellers will appear here after launch. In the meantime you can plan a nature stay or enquire about gardening help.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton href="/gardening" variant="outline" size="lg" className="rounded-full border-forest-800/25 px-7 text-forest-900 hover:bg-forest-900/5">Gardening services</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
