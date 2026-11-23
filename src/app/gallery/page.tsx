import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { PhotoGallery, type PhotoItem } from "@/components/site/photo-gallery";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";
import { basePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Gallery: the countryside, farm life and slow days",
  description: "Photographs of Karnataka countryside, farm stays, cycling roads, gardens and evenings outdoors. Browse by category and open any photo full size.",
  alternates: { canonical: `${basePath}/gallery` },
};

const categories = ["Landscapes", "Stays", "Cycling", "Gardens and food", "Evenings", "People outdoors"];

const items: PhotoItem[] = [
  { src: images.heroSunriseFields, category: "Landscapes", caption: "Sunrise over paddy fields", alt: "Sunrise over green paddy fields and coconut palms in Karnataka" },
  { src: images.mistyHills, category: "Landscapes", caption: "Misty hills near a village", alt: "Misty green hills above a village in Karnataka" },
  { src: images.forestLightBeam, category: "Landscapes", caption: "A forest valley at dusk", alt: "A forested valley in the Western Ghats at dusk" },
  { src: images.forestPath, category: "Landscapes", caption: "A winding hill road", alt: "A winding road through green hills in Karnataka" },
  { src: images.rosePathway, category: "Landscapes", caption: "A forest path of red soil", alt: "A forest path of red soil running between trees" },
  { src: images.cabinMisty, category: "Stays", caption: "A tiled-roof verandah", alt: "The verandah of a tiled-roof farmhouse in Karnataka" },
  { src: images.farmhouseCottage, category: "Stays", caption: "A farmhouse courtyard", alt: "A farmhouse cottage courtyard in warm evening light" },
  { src: images.cozyInterior, category: "Stays", caption: "A shaded verandah corridor", alt: "A shaded verandah corridor of a country house" },
  { src: images.cyclistSoloHill, category: "Cycling", caption: "A family on a tree-lined lane", alt: "A family of three cycling along a tree-lined country lane" },
  { src: images.cyclistsDuo, category: "Cycling", caption: "A plantation road", alt: "A scenic plantation road in the Karnataka countryside" },
  { src: images.forestRoadGold, category: "Cycling", caption: "A quiet road among coconut trees", alt: "A quiet rural road lined with coconut trees" },
  { src: images.strawberryHarvest, category: "Gardens and food", caption: "Among the flower beds", alt: "A smiling woman standing in a flower bed" },
  { src: images.eucalyptusBranch, category: "Gardens and food", caption: "Marigolds in bloom", alt: "Marigold flowers growing in a garden" },
  { src: images.seedlingsPots, category: "Gardens and food", caption: "A harvest of vegetables", alt: "An assortment of freshly harvested vegetables" },
  { src: images.carrotsHarvest, category: "Gardens and food", caption: "A mixed vegetable harvest", alt: "A mixed harvest of garden vegetables" },
  { src: images.gardeningTools, category: "Gardens and food", caption: "A child with a leaf", alt: "A child holding a leaf in a garden" },
  { src: images.breakfastSpread, category: "Gardens and food", caption: "A South Indian breakfast", alt: "Idli and sambar served as a South Indian breakfast" },
  { src: images.bonfireGroup, category: "Evenings", caption: "Gathering by firelight", alt: "People gathered around a fire in the evening" },
  { src: images.milkyWay, category: "Evenings", caption: "A night sky away from the city", alt: "The Milky Way over a dark night sky" },
  { src: images.kidsPlayingMisty, category: "People outdoors", caption: "Children playing in an open field", alt: "Children playing in an open field" },
  { src: images.corporateRusticMeeting, category: "People outdoors", caption: "A group walking through a grove", alt: "A group of people walking through a grove of trees" },
];

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="The countryside, in pictures."
        description="Landscapes, farm life, quiet roads and evenings outdoors. Browse by category and open any photograph full size."
        image={images.heroSunriseFields}
        crumb="Gallery"
        primaryCta={{ label: "Explore available stays", href: "/stays" }}
      />

      <section className="bg-cream py-20">
        <div className="container-nidhi">
          <PhotoGallery items={items} categories={categories} />
          <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink/65">
            These photographs are illustrative of the Karnataka countryside and rural life. They are not photographs of any particular listed property. Each stay shows its own host-supplied photographs on its page.
          </p>
        </div>
      </section>

      <CtaBand
        title="See a stay for yourself."
        description="Each property page has its own photographs, amenities and price breakdown."
        primaryLabel="Explore available stays"
        primaryHref="/stays"
        secondaryLabel="Ask our team"
        secondaryHref="/contact"
      />
    </>
  );
}
