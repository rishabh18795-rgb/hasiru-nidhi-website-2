import Image from "next/image";
import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { images } from "@/lib/content";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A visual tour of Hasiru Nidhi — farmhouse stays, cycling trails, gardens, bonfire evenings and the working landscape near Bengaluru.",
  alternates: { canonical: "/gallery" },
};

const galleryItems = [
  { src: images.heroSunriseFields, caption: "Sunrise over the fields", tall: true },
  { src: images.cabinMisty, caption: "A farmhouse room in the morning mist" },
  { src: images.strawberryHarvest, caption: "Harvest baskets, kitchen garden" },
  { src: images.cyclistSoloHill, caption: "The farmland cycling loop" },
  { src: images.rosePathway, caption: "The landscaped garden pathway", tall: true },
  { src: images.bonfireGroup, caption: "Bonfire evening, after dinner" },
  { src: images.breakfastSpread, caption: "Breakfast, largely from our own beds" },
  { src: images.kidsPlayingMisty, caption: "An afternoon on open ground" },
  { src: images.seedlingsPots, caption: "Seedlings in the nursery beds" },
  { src: images.farmhouseCottage, caption: "The farmhouse at golden hour", tall: true },
  { src: images.milkyWay, caption: "Clear skies, away from city light" },
  { src: images.cyclistsDuo, caption: "An easy ride through the village extension" },
  { src: images.saladBowl, caption: "A shared table, seasonal produce" },
  { src: images.corporateRusticMeeting, caption: "An offsite, mid-conversation" },
  { src: images.forestLightBeam, caption: "Morning light through the tree line" },
];

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="The grounds, as they actually look."
        description="No staged shots — this is what a day at Hasiru Nidhi looks like, across seasons and light."
        image={images.pineForestSoft}
        crumb="Gallery"
      />

      <section className="bg-cream py-28">
        <div className="container-nidhi">
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {galleryItems.map((item, i) => (
              <Reveal
                key={item.caption}
                delay={(i % 6) * 0.05}
                className="group relative overflow-hidden rounded-2xl"
              >
                <div className={item.tall ? "relative aspect-[3/4]" : "relative aspect-[4/3]"}>
                  <Image
                    src={item.src}
                    alt={item.caption}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-forest-950/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="p-4 text-sm text-cream">{item.caption}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Prefer to see it in person?"
        description="Photos only tell half of it. Come spend a day on the grounds."
      />
    </>
  );
}
