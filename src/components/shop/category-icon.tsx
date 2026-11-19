import { Hammer, HeartHandshake, Leaf, Sprout, TreePine, Wheat, ShoppingBasket, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "plants-seeds-saplings": Sprout,
  "gardening-tools-accessories": Hammer,
  "organic-fertilisers-compost": Leaf,
  "handmade-eco-friendly": HeartHandshake,
  "farm-produce-organic-food": Wheat,
  "nature-lifestyle": TreePine,
};

/** A neutral icon for a category. Admin-added categories fall back to a basket; no product pictures are implied. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? ShoppingBasket;
  return <Icon className={className} aria-hidden="true" />;
}
