/**
 * Display names for the catalogue slugs used by the built-in demo dataset. These mirror the vocabulary created by the database
 * migrations (a test checks every demo slug exists there), so demo mode and the live site describe things identically.
 */
export const CATEGORY_NAMES: Record<string, string> = {
  "farm-stay": "Farm stays",
  cottage: "Cottages",
  "eco-retreat": "Eco-retreats",
  "nature-retreat": "Nature retreats",
  "cycling-friendly": "Cycling-friendly stays",
};

export const AMENITY_NAMES: Record<string, string> = {
  wifi: "Wi-Fi",
  parking: "Free parking",
  "home-cooked-meals": "Home-cooked meals",
  "veg-meals": "Vegetarian meals",
  "kitchen-garden": "Kitchen garden access",
  bonfire: "Bonfire area",
  bicycles: "Bicycles available",
  "hot-water": "Hot water",
  "power-backup": "Power backup",
  "children-play-area": "Children's play area",
  "private-bathroom": "Private bathroom",
  kitchen: "Kitchen",
  garden: "Garden",
  "outdoor-seating": "Outdoor seating",
};

export const EXPERIENCE_NAMES: Record<string, string> = {
  "cycling-trails": "Cycling trails",
  "gardening-sessions": "Gardening sessions",
  "nature-walks": "Nature walks",
  "farm-to-table-meals": "Farm-to-table meals",
  "village-walk": "Village walks",
  stargazing: "Stargazing",
  "yoga-wellness": "Yoga and slow mornings",
  "local-food-experiences": "Local food experiences",
  "family-activities": "Family activities",
  "bonfire-evenings": "Bonfire evenings",
};

export const ARRANGEMENT_LABEL: Record<string, string> = {
  entire_property: "Entire property",
  private_rooms: "Private rooms",
  shared_space: "Shared space",
};
