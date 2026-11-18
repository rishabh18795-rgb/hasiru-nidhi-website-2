import { basePath } from "@/lib/base-path";

// Curated photography, downloaded locally into /public/images so production
// doesn't depend on an external host. Illustrative imagery chosen to evoke
// the brand's Indian-countryside-with-premium-hospitality feel — not actual
// property photography. Swap for verified on-site photography of Hasiru
// Nidhi before launch (see README).
function localImage(filename: string) {
  return `${basePath}/images/${filename}`;
}

export const images = {
  heroSunriseFields: localImage("hero/hero-sunrise-paddy-coconut-karnataka.jpg"),
  forestPath: localImage("gallery/winding-green-hill-road-karnataka.jpg"),
  treeOfLife: localImage("tree-of-life-farmland.jpg"),
  aerialCanopy: localImage("gallery/winding-green-hill-road-karnataka.jpg"),
  mistyHills: localImage("gallery/misty-hills-village-karnataka.jpg"),
  forestLightBeam: localImage("gallery/forest-valley-dusk-western-ghats.jpg"),
  pineForestSoft: localImage("gallery/winding-green-hill-road-karnataka.jpg"),
  forestRoadGold: localImage("cycling/rural-road-coconut-trees-karnataka.jpg"),

  cabinMisty: localImage("stay/farmhouse-tiled-roof-verandah-karnataka.jpg"),
  farmhouseCottage: localImage("stay/farmhouse-cottage-courtyard-karnataka.jpg"),
  campingTentDusk: localImage("stay/evening-firelight-gathering-karnataka.jpg"),
  milkyWay: localImage("night-sky-stargazing.jpg"),
  cozyInterior: localImage("stay/verandah-corridor-karnataka.jpg"),

  gardeningTools: localImage("gardening/child-with-leaf-garden-karnataka.jpg"),
  seedlingsPots: localImage("gardening/assorted-vegetables-harvest-karnataka.jpg"),
  strawberryHarvest: localImage("gardening/smiling-woman-flower-bed-karnataka.jpg"),
  seedTrays: localImage("gardening/assorted-vegetables-harvest-karnataka.jpg"),
  eucalyptusBranch: localImage("gardening/marigold-flowers-garden-karnataka.jpg"),
  carrotsHarvest: localImage("gardening/mixed-vegetable-harvest-karnataka.jpg"),

  rosePathway: localImage("landscaping/forest-path-red-soil-karnataka.jpg"),

  cyclistSoloHill: localImage("cycling/family-of-three-cycling-tree-lane-karnataka.jpg"),
  cyclistsDuo: localImage("cycling/scenic-plantation-road-karnataka.jpg"),
  bicycleDetail: localImage("cycling/rural-road-coconut-trees-karnataka.jpg"),

  bonfireGroup: localImage("stay/evening-firelight-gathering-karnataka.jpg"),

  breakfastSpread: localImage("gallery/south-indian-breakfast-idli-sambar.jpg"),
  saladBowl: localImage("gardening/child-with-leaf-garden-karnataka.jpg"),

  kidsPlayingMisty: localImage("gallery/children-playing-open-field-karnataka.jpg"),

  corporateRusticMeeting: localImage("gallery/group-walking-grove-karnataka.jpg"),
} as const;

export type PillarSlug =
  | "nature-stay"
  | "cycling"
  | "gardening"
  | "landscaping";

export interface Pillar {
  slug: PillarSlug;
  href: string;
  icon: "Home" | "Bike" | "Sprout" | "TreePine";
  label: string;
  title: string;
  summary: string;
  image: string;
}

export const pillars: Pillar[] = [
  {
    slug: "nature-stay",
    href: "/nature-stay",
    icon: "Home",
    label: "01 — Stay",
    title: "Nature Stay",
    summary:
      "Farm stays, cottages and eco-retreats set in the landscape, listed by their owners and reviewed by our team.",
    image: images.cabinMisty,
  },
  {
    slug: "cycling",
    href: "/cycling",
    icon: "Bike",
    label: "02 — Ride",
    title: "Cycling",
    summary:
      "Quiet roads and farm tracks, ridden at the pace of the scenery. Look for cycling-friendly stays.",
    image: images.cyclistSoloHill,
  },
  {
    slug: "gardening",
    href: "/gardening",
    icon: "Sprout",
    label: "03 — Grow",
    title: "Gardening Services",
    summary:
      "Hands in the soil, season by season. Learn how we raise a working kitchen garden, or bring the practice home.",
    image: images.gardeningTools,
  },
  {
    slug: "landscaping",
    href: "/landscaping",
    icon: "TreePine",
    label: "04 — Design",
    title: "Landscaping",
    summary:
      "Land shaped with restraint — native planting, stone paths and water-wise design for grounds that mature gracefully.",
    image: images.rosePathway,
  },
];

export interface ExperienceEntry {
  title: string;
  description: string;
  image: string;
  href?: string;
}

export const experiences: ExperienceEntry[] = [
  {
    title: "Cycling trails",
    description: "Unhurried rides on quiet roads and farm tracks, at the pace of the scenery rather than the clock.",
    image: images.cyclistSoloHill,
    href: "/cycling",
  },
  {
    title: "Gardening sessions",
    description: "Time among beds, seedlings and compost: a gentle way to learn how food and flowers grow.",
    image: images.seedlingsPots,
    href: "/stays?experiences=gardening-sessions",
  },
  {
    title: "Nature walks",
    description: "Slow walks for trees, birds and the small details that disappear at speed.",
    image: images.forestRoadGold,
    href: "/stays?experiences=nature-walks",
  },
  {
    title: "Bonfire evenings",
    description: "Firelight, open sky and conversation once the day winds down.",
    image: images.bonfireGroup,
    href: "/stays?experiences=bonfire-evenings",
  },
  {
    title: "Farm-to-table meals",
    description: "Simple meals shaped by what the season and the garden offer.",
    image: images.breakfastSpread,
    href: "/stays?experiences=farm-to-table-meals",
  },
  {
    title: "Village walks",
    description: "A walk into nearby village life, with a local guide where the host arranges one.",
    image: images.mistyHills,
    href: "/stays?experiences=village-walk",
  },
  {
    title: "Stargazing",
    description: "Dark-sky evenings, away from the glow of the city.",
    image: images.milkyWay,
    href: "/stays?experiences=stargazing",
  },
  {
    title: "Yoga and slow mornings",
    description: "Outdoor movement, rest and nowhere to be before breakfast.",
    image: images.pineForestSoft,
    href: "/stays?experiences=yoga-wellness",
  },
];

/** The platform's real stay categories (the same ones hosts choose from and guests can filter by). */
export const stayCategories = [
  { slug: "farm-stay", name: "Farm stays", description: "Stay on a working farm or garden estate, close to the growing season and the people who tend it.", image: images.farmhouseCottage },
  { slug: "village-homestay", name: "Village homestays", description: "Live alongside a local host family and see everyday village life from the inside.", image: images.mistyHills },
  { slug: "cottage", name: "Cottages", description: "Private cottages set in nature, for guests who want space and quiet.", image: images.cabinMisty },
  { slug: "eco-retreat", name: "Eco-retreats", description: "Low-impact stays built around the landscape rather than on top of it.", image: images.forestLightBeam },
  { slug: "family-getaway", name: "Family getaways", description: "Easy, safe stays that work for children and grandparents alike.", image: images.kidsPlayingMisty },
  { slug: "cycling-friendly", name: "Cycling-friendly stays", description: "Stays that offer bicycles, safe routes and early-start breakfasts.", image: images.cyclistsDuo },
] as const;

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

// Testimonials are intentionally EMPTY. Add real, permission-granted guest quotes here and the
// "Guest Notes" section on the home page will appear. Never publish invented reviews.
export const testimonials: Testimonial[] = [];

export interface Package {
  slug: string;
  name: string;
  bestFor: string;
  description: string;
  image: string;
  featured?: boolean;
}

/**
 * Experience packages at the Hasiru Nidhi farm are planned through an enquiry. Prices, inclusions, timings and availability are NOT
 * published here because none of them has been confirmed by the business; the team provides them when someone enquires.
 */
export const packages: Package[] = [
  {
    slug: "day-escape",
    name: "A day on the farm",
    bestFor: "First visits and small groups",
    description: "A day outdoors without an overnight stay: time in the garden, a gentle walk or ride, and a meal at the table.",
    image: images.gardeningTools,
  },
  {
    slug: "farmhouse-overnight",
    name: "A night on the farm",
    bestFor: "Couples, families and small groups",
    description: "One night close to the land, with an evening outdoors and a slow morning after.",
    image: images.farmhouseCottage,
    featured: true,
  },
  {
    slug: "weekend-retreat",
    name: "A weekend retreat",
    bestFor: "Slow travellers and small groups",
    description: "A longer stay for guests who want unscheduled afternoons as well as planned experiences.",
    image: images.cabinMisty,
  },
  {
    slug: "corporate-offsite",
    name: "A team day outdoors",
    bestFor: "Teams planning an offsite",
    description: "An outdoor-led day for a team, planned around your group size, goals and dates.",
    image: images.corporateRusticMeeting,
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const faqs: FaqEntry[] = [
  {
    question: "What is Hasiru Nidhi?",
    answer:
      "Hasiru Nidhi is a marketplace for peaceful nature stays: farm stays, cottages, homestays and eco-retreats listed by their owners. It began as a working farm near Bengaluru and now also helps other property owners reach travellers. We also offer gardening services, which are separate from stay bookings.",
  },
  {
    question: "How do I find and request a stay?",
    answer:
      "Use the search on the homepage or Explore Stays. Enter a six-digit PIN code or a place, then choose your dates and guests. Open a property to see its photographs, amenities, house rules and a full price breakdown, then send the host a booking request. A request is not a confirmed booking: the host reviews it and accepts or declines, and you can follow the status under My bookings.",
  },
  {
    question: "Do I pay online?",
    answer:
      "Not yet. Sending a request costs nothing and nothing is charged on this website. Payment arrangements are shared when your booking is confirmed. We will announce online payment on the site once it is available, and we will never show a payment as received unless it has been.",
  },
  {
    question: "Can I cancel a booking?",
    answer:
      "Yes. Every property shows its cancellation policy before you request. You can cancel a request, or a confirmed booking before check-in, from My bookings, and the host is told. Because the platform does not collect payment yet, any refund is settled between you and the host according to that policy.",
  },
  {
    question: "How are properties checked before they appear?",
    answer:
      "Hosts submit their property with photographs, location and pricing, and our team reviews each listing before it is published. Listings that are still drafts, waiting for review, returned for changes or suspended never appear in search.",
  },
  {
    question: "How do I list my property?",
    answer:
      "Create a host account, then follow the guided steps: property details, address and PIN code, photographs, amenities and rules, pricing and availability. You can save a draft at any time and submit when you are ready. After approval you manage your calendar, booking requests and earnings from your host dashboard.",
  },
  {
    question: "Are Gardening Services part of a stay booking?",
    answer:
      "No. Gardening Services is a separate offering: you send an enquiry describing your space and our team replies. An enquiry never creates a stay booking, and a stay booking never creates a gardening job.",
  },
  {
    question: "Where is the Hasiru Nidhi farm located?",
    answer:
      "We're just off Kanakapura Road in Harohalli, Bengaluru Rural. The final stretch is a quiet country road — we send a detailed map link with every confirmed booking.",
  },
  {
    question: "Can we visit for the day without an overnight stay?",
    answer:
      "Day visits to our farm are arranged by enquiry. Use the Farm Visit Enquiry page to tell us your date and group size. Our team replies to confirm timings, what is included and the cost, and nothing is booked until you hear back.",
  },
  {
    question: "Is it suitable for young children and older guests?",
    answer:
      "Suitability depends on the property and the activity. For our own farm, tell our team about young children, older guests or mobility needs when you enquire. For a marketplace stay, check the listing and ask the host before you request.",
  },
  {
    question: "What about food and dietary needs?",
    answer:
      "Meals vary by property, and each listing says what the host can provide. For a visit to our farm, mention any dietary needs when you enquire so our team can confirm what is possible.",
  },
  {
    question: "Do you allow pets?",
    answer:
      "Pet rules are set by each host and appear in the house rules on the listing. If the listing does not say, ask the host before you request. For a visit to our farm, ask when you enquire.",
  },
  {
    question: "What should we pack?",
    answer:
      "Comfortable closed shoes, a light layer for the evening, a hat, sun protection and drinking water suit most nature stays. What a property provides, such as bicycles or tools, is described on its listing, so check it or ask the host.",
  },
  {
    question: "How do I book an experience at the Hasiru Nidhi farm?",
    answer:
      "Use the Farm Visit Enquiry page to tell us what you would like and when. Our team replies to confirm availability and arrangements; nothing is booked until you hear back. The website does not take online payments yet.",
  },
  {
    question: "Can I bring a large group?",
    answer:
      "Group limits differ by property, and each listing shows its maximum guests. For a larger group at our farm, send an enquiry with your headcount and dates and our team will tell you what is possible.",
  },
];

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
  content: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "why-a-kitchen-garden-changes-how-you-eat",
    title: "Why a kitchen garden changes how you eat",
    excerpt: "An hour among growing things shifts how people think about food. A short guide to making the most of garden time on a nature stay.",
    date: "2026-11-18",
    readTime: "3 min read",
    category: "Gardening",
    image: images.seedlingsPots,
    content: [
      "Food that has travelled from bed to basket in a few hours tastes different, and it asks to be cooked simply. A vegetable straight from the soil rarely needs much more than heat, salt and a little patience.",
      "Spending time in a garden also changes the pace of a meal. When you have watched something grow from a seedling, you tend to eat it more slowly. Even an hour of weeding or watering can make an ordinary lunch feel earned.",
      "If a stay on Hasiru Nidhi offers gardening sessions or kitchen-garden access, the listing will say so. Wear closed shoes, bring a hat and water, and let the host guide you: gardens are working places, not displays.",
    ],
  },
  {
    slug: "the-slow-case-for-cycling-through-farmland",
    title: "The slow case for cycling through the countryside",
    excerpt: "Riding for the view rather than the stopwatch: what changes, and a few sensible habits for a safe, unhurried ride.",
    date: "2026-11-18",
    readTime: "3 min read",
    category: "Cycling",
    image: images.cyclistSoloHill,
    content: [
      "A slow ride has a different purpose from a fast one. At an easy pace you notice a farmer at work, a bird at the edge of a pond, the way early light settles on a field. That is the whole point of riding for pleasure.",
      "A few habits make an unhurried ride safer. Wear a helmet, carry water, ride in daylight, keep to quiet roads and tracks, and tell someone where you are going. Check the bicycle before you set off, especially the brakes and tyres.",
      "Some stays are listed as cycling-friendly and may offer bicycles or suggest routes. Always confirm with the host what is available before you travel, and follow their advice about local roads and conditions.",
    ],
  },
  {
    slug: "planning-a-corporate-offsite-that-doesnt-feel-like-work",
    title: "Planning a team day outdoors",
    excerpt: "A practical checklist for an outdoor-led team day: purpose, pace, food and a proper break from routine.",
    date: "2026-11-18",
    readTime: "4 min read",
    category: "Team days",
    image: images.corporateRusticMeeting,
    content: [
      "Start with a single purpose. A team day outdoors works best when you know whether it is meant to plan, to connect or simply to rest. Everything else, from the schedule to the venue, follows from that.",
      "Front-load the outdoors. Put the active or hands-on part early, when energy is high, and keep any discussion for a quieter, shaded stretch later. Leave real gaps in the day; people connect in the unscheduled minutes.",
      "Plan food and logistics early: group size, dietary needs, travel time, shade, drinking water and a plan for rain. If you would like to explore a team day at the Hasiru Nidhi farm, send us an enquiry with your headcount and dates and our team will reply with what is possible.",
    ],
  },
  {
    slug: "a-field-guide-to-our-bonfire-evenings",
    title: "A field guide to a good bonfire evening",
    excerpt: "What makes an evening by the fire work, and how to enjoy it safely and considerately.",
    date: "2026-11-18",
    readTime: "3 min read",
    category: "Nature stays",
    image: images.bonfireGroup,
    content: [
      "A good bonfire evening needs very little: a safe, contained fire, loose seating, warm layers and enough time. There is no need for a programme. Conversation usually arrives by itself once the light fades.",
      "Away from city lights the sky is worth a look. Give your eyes a few minutes to adjust, put phones away, and see what you can find overhead. Clear, moonless nights show the most.",
      "Fire safety matters more than atmosphere. Keep children and loose clothing away from the flames, never leave a fire unattended, and follow your host's rules about where and when fires are allowed. Where a stay offers bonfire evenings, the listing will say so.",
    ],
  },
];

export const stats = [
  { value: "12", label: "Acres of working farmland" },
  { value: String(experiences.length), label: "Kinds of experience a stay can offer" },
  { value: String(stayCategories.length), label: "Kinds of nature stay to choose from" },
];

export const futureVentures = [
  {
    title: "The Plant Store",
    description:
      "A curated nursery counter for native and low-maintenance species, opening to the public.",
    icon: "Sprout" as const,
  },
  {
    title: "Landscaping Studio",
    description:
      "Taking our on-ground design practice to private gardens and campuses beyond Hasiru Nidhi.",
    icon: "TreePine" as const,
  },
  {
    title: "Wellness Retreat",
    description:
      "A dedicated wing for slow mornings, outdoor movement and guided rest — in early development.",
    icon: "Leaf" as const,
  },
];
