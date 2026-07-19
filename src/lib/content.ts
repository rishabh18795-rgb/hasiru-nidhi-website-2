// Curated photography used across the site. Sourced from Unsplash (free-to-use
// licence) as premium placeholder imagery — swap for on-site photography of
// Hasiru Nidhi before launch.
function unsplash(id: string, params = "auto=format&fit=crop&q=80") {
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

export const images = {
  heroSunriseFields: unsplash("1470252649378-9c29740c9fa8"),
  forestPath: unsplash("1441974231531-c6227db76b6e"),
  treeOfLife: unsplash("1502082553048-f009c37129b9"),
  aerialCanopy: unsplash("1476231682828-37e571bc172f"),
  mistyHills: unsplash("1487621167305-5d248087c724"),
  forestLightBeam: unsplash("1500673922987-e212871fec22"),
  pineForestSoft: unsplash("1425913397330-cf8af2ff40a1"),
  forestRoadGold: unsplash("1476820865390-c52aeebb9891"),

  cabinMisty: unsplash("1449158743715-0a90ebb6d2d8"),
  farmhouseCottage: unsplash("1449844908441-8829872d2607"),
  campingTentDusk: unsplash("1487730116645-74489c95b41b"),
  milkyWay: unsplash("1465101162946-4377e57745c3"),
  cozyInterior: unsplash("1505691938895-1758d7feb511"),

  gardeningTools: unsplash("1416879595882-3373a0480b5b"),
  seedlingsPots: unsplash("1523348837708-15d4a09cfac2"),
  strawberryHarvest: unsplash("1500651230702-0e2d8a49d4ad"),
  cropRowsAerial: unsplash("1592982537447-7440770cbfc9"),
  seedTrays: unsplash("1466692476868-aef1dfb1e735"),
  eucalyptusBranch: unsplash("1466781783364-36c955e42a7f"),
  poppyFlowers: unsplash("1490750967868-88aa4486c946"),
  carrotsHarvest: unsplash("1471193945509-9ad0617afabf"),

  rosePathway: unsplash("1585320806297-9794b3e4eeae"),

  cyclistSoloHill: unsplash("1471506480208-91b3a4cc78be"),
  cyclistsDuo: unsplash("1541625602330-2277a4c46182"),
  bicycleDetail: unsplash("1485965120184-e220f721d03e"),

  bonfireGroup: unsplash("1475483768296-6163e08872a1"),
  familyBonfireSilhouette: unsplash("1478131143081-80f7f84ca84d"),

  soupBowl: unsplash("1476718406336-bb5a9690ee2a"),
  breakfastSpread: unsplash("1490645935967-10de6ba17061"),
  saladBowl: unsplash("1512621776951-a57141f2eefd"),
  latteHands: unsplash("1495474472287-4d71bcdd2085"),
  blueberriesMacro: unsplash("1502741338009-cac2772e18bc"),

  kidsPlayingMisty: unsplash("1502086223501-7ea6ecd79368"),
  yogaDockSilhouette: unsplash("1506126613408-eca07ce68773"),
  yogaBeachSilhouette: unsplash("1544367567-0f2fcb009e0b"),

  corporateLaptops: unsplash("1522071820081-009f0129c71c"),
  corporateWhiteboard: unsplash("1552664730-d307ca884978"),
  corporateRusticMeeting: unsplash("1521737604893-d14cc237f11d"),
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
      "Farmhouse rooms and open-air cottages built into the landscape, where the loudest sound after dark is a cricket chorus.",
    image: images.cabinMisty,
  },
  {
    slug: "cycling",
    href: "/cycling",
    icon: "Bike",
    label: "02 — Ride",
    title: "Cycling",
    summary:
      "Quiet backroads, working farmland and gentle climbs — guided rides paced for first-timers and early risers alike.",
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
    title: "Nature Stay",
    description:
      "Farmhouse rooms and cottages framed by field and forest, designed for uninterrupted rest.",
    image: images.cabinMisty,
    href: "/nature-stay",
  },
  {
    title: "Cycling Trails",
    description:
      "Guided rides through working farmland on routes chosen for scenery over speed.",
    image: images.cyclistSoloHill,
    href: "/cycling",
  },
  {
    title: "Gardening & Growing",
    description:
      "A working kitchen garden you can join, from seed tray to harvest basket.",
    image: images.seedlingsPots,
    href: "/gardening",
  },
  {
    title: "Landscaping & Grounds",
    description:
      "Native planting and thoughtful land design across the property, open to walk and study.",
    image: images.rosePathway,
    href: "/landscaping",
  },
  {
    title: "Bonfire Evenings",
    description:
      "Firelight, quiet conversation and a sky full of stars once the sun goes down.",
    image: images.bonfireGroup,
  },
  {
    title: "Healthy, Honest Food",
    description:
      "Meals built around what the garden gives that week, served at a shared table.",
    image: images.breakfastSpread,
  },
  {
    title: "Village Experiences",
    description:
      "Walks into the neighbouring village — its bazaar, its bullock carts, its everyday rhythm.",
    image: images.forestRoadGold,
  },
  {
    title: "Family Experiences",
    description:
      "Open ground, real mud and no screens — a day the children will describe long after.",
    image: images.kidsPlayingMisty,
  },
  {
    title: "Corporate Retreats",
    description:
      "Offsites built around outdoor work, shared meals and enough quiet to think clearly.",
    image: images.corporateRusticMeeting,
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

// Placeholder testimonials for layout and tone reference — replace with
// verified guest quotes before launch.
export const testimonials: Testimonial[] = [
  {
    quote:
      "We came for a weekend and left talking about the sunrise cycle for weeks. Nothing about the stay felt staged — it felt like someone's real, well-loved farm.",
    name: "Ananya R.",
    role: "Bengaluru",
  },
  {
    quote:
      "Our offsite usually means a hotel conference room with worse lighting. This time the team gardened for an hour before the first meeting. Everyone was sharper for it.",
    name: "Karthik M.",
    role: "Team Lead, product studio",
  },
  {
    quote:
      "My kids are still talking about the bonfire and the goats. I am still thinking about the food — simple, seasonal, and better than anything from a menu.",
    name: "Priya D.",
    role: "Visiting with family",
  },
  {
    quote:
      "The gardening walkthrough alone was worth the trip. I went home and finally started the kitchen garden I'd been putting off for two years.",
    name: "Rahul S.",
    role: "First-time visitor",
  },
];

export interface Package {
  slug: string;
  name: string;
  duration: string;
  bestFor: string;
  description: string;
  inclusions: string[];
  image: string;
  featured?: boolean;
}

export const packages: Package[] = [
  {
    slug: "day-escape",
    name: "The Day Escape",
    duration: "9 AM – 6 PM",
    bestFor: "First visits, small groups",
    description:
      "A full day on the grounds — garden walk, a short cycling loop, and a farm-table lunch — without committing to an overnight stay.",
    inclusions: [
      "Guided garden & grounds walk",
      "Leisure cycling loop (bikes provided)",
      "Farm-table lunch",
      "Evening tea and snacks",
    ],
    image: images.gardeningTools,
  },
  {
    slug: "farmhouse-overnight",
    name: "Farmhouse Overnight",
    duration: "1 Night / 2 Days",
    bestFor: "Couples, families, small groups",
    description:
      "Our signature stay — a night in a farmhouse room, bonfire under open sky, and a full day of nature-led experiences.",
    inclusions: [
      "Overnight farmhouse or cottage stay",
      "All meals (dinner, breakfast, lunch)",
      "Bonfire evening",
      "Cycling trail & garden walk",
      "Village walk (seasonal)",
    ],
    image: images.farmhouseCottage,
    featured: true,
  },
  {
    slug: "weekend-retreat",
    name: "The Weekend Retreat",
    duration: "2 Nights / 3 Days",
    bestFor: "Slow travellers, small groups",
    description:
      "For guests who want to properly unhurry — two full days across cycling, gardening, village walks and long, unscheduled afternoons.",
    inclusions: [
      "2 nights farmhouse or cottage stay",
      "All meals, both days",
      "Cycling trail, garden immersion, village walk",
      "Two bonfire evenings",
      "One guided nature session (birding or stargazing, seasonal)",
    ],
    image: images.cabinMisty,
  },
  {
    slug: "corporate-offsite",
    name: "Corporate Offsite",
    duration: "Custom, day or overnight",
    bestFor: "Teams of 10–60",
    description:
      "A working offsite built around the outdoors — team activities on the grounds, meeting-ready spaces, and food that keeps energy steady through the day.",
    inclusions: [
      "Private meeting/breakout space",
      "Outdoor team activities (garden, cycling, or lawn games)",
      "Full-day catering",
      "Custom itinerary & dedicated coordinator",
    ],
    image: images.corporateRusticMeeting,
  },
];

export interface PricingTier {
  name: string;
  price: string;
  unit: string;
  description: string;
  features: string[];
  featured?: boolean;
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Day Visit",
    price: "₹1,800",
    unit: "per adult",
    description: "Grounds access, one guided activity and a farm-table lunch.",
    features: [
      "9 AM – 6 PM access",
      "One guided experience",
      "Farm-table lunch included",
      "Children under 6 free",
    ],
  },
  {
    name: "Farmhouse Overnight",
    price: "₹6,500",
    unit: "per adult, twin sharing",
    description: "Our most-booked stay — a full night and two days on the grounds.",
    features: [
      "1 night in a farmhouse room",
      "All meals included",
      "Bonfire evening",
      "Cycling & garden walk",
    ],
    featured: true,
  },
  {
    name: "Weekend Retreat",
    price: "₹11,800",
    unit: "per adult, twin sharing",
    description: "Two nights, unhurried — for guests who want the fullest experience.",
    features: [
      "2 nights, farmhouse or cottage",
      "All meals, both days",
      "Two bonfire evenings",
      "One seasonal nature session",
    ],
  },
  {
    name: "Corporate Offsite",
    price: "On request",
    unit: "custom per group",
    description: "Priced by group size, duration and activities selected.",
    features: [
      "Private breakout space",
      "Custom activity itinerary",
      "Full-day catering",
      "Dedicated coordinator",
    ],
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const faqs: FaqEntry[] = [
  {
    question: "Where exactly is Hasiru Nidhi located, and how far from Bengaluru?",
    answer:
      "We're just off Kanakapura Road in Harohalli, roughly 45–60 minutes from central Bengaluru depending on traffic. The final stretch is a quiet country road — we send a detailed map link with every confirmed booking.",
  },
  {
    question: "Can we visit for the day without an overnight stay?",
    answer:
      "Yes — the Day Escape package runs 9 AM to 6 PM and includes a guided activity and lunch. Day visits are by prior booking only; we don't accept walk-ins so we can keep group sizes comfortable.",
  },
  {
    question: "Is Hasiru Nidhi suitable for young children and older guests?",
    answer:
      "Very much so. The grounds are flat to gently sloped with paved and packed-earth paths. We ask that young children be supervised near the pond and garden beds, and we're happy to adapt activities for mobility needs — just let us know when booking.",
  },
  {
    question: "What is the food like, and can you accommodate dietary needs?",
    answer:
      "Meals are vegetarian, largely sourced from our own garden and local farms, and served at a shared table. We accommodate Jain, vegan and common allergy requirements with advance notice.",
  },
  {
    question: "Do you allow pets?",
    answer:
      "Well-behaved leashed pets are welcome on the grounds. Please mention this at the time of booking so we can prepare the right room and manage introductions to our own farm animals.",
  },
  {
    question: "What should we pack?",
    answer:
      "Comfortable closed shoes for the garden and cycling trail, a light layer for the evening, and sun protection. We provide bicycles, helmets and gardening tools — no equipment needed from your end.",
  },
  {
    question: "How does booking and payment work?",
    answer:
      "Submit an enquiry through the Contact page or WhatsApp with your preferred dates and group size. We confirm availability within 24 hours and hold your booking with a 30% advance; the balance is settled on arrival.",
  },
  {
    question: "Can Hasiru Nidhi host a group larger than 20 people?",
    answer:
      "Yes, for both leisure groups and corporate offsites. Larger groups typically book the full property — reach out via the Contact page with your headcount and dates and we'll put together a custom plan.",
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
    title: "Why a Kitchen Garden Changes How You Eat",
    excerpt:
      "There is a specific kind of hunger that only shows up after an hour of weeding. Here's what our working garden has taught us about food.",
    date: "2026-05-14",
    readTime: "6 min read",
    category: "Gardening",
    image: images.seedlingsPots,
    content: [
      "Most of what we grow at Hasiru Nidhi never makes it to a supplier's crate. It goes from bed to basket to kitchen, usually within a few hours, which changes the food in ways that are hard to describe until you've tasted it — a tomato that still smells faintly of its own vine, greens that haven't spent three days in transit.",
      "The garden also changes the pace of a meal. When you've watched something grow from seed tray to harvest, you tend to eat it more slowly, and cook it more simply. We've found ourselves doing less to the food, not more, letting a good carrot or a ripe brinjal carry the plate on its own.",
      "For guests, an hour in the garden before lunch tends to do something similar. People who've never thought much about where a vegetable comes from leave the beds with soil under their nails and, more often than not, a noticeably better appetite.",
    ],
  },
  {
    slug: "the-slow-case-for-cycling-through-farmland",
    title: "The Slow Case for Cycling Through Farmland",
    excerpt:
      "Our cycling trail was never designed for speed. Here's why we built it around scenery, gradient and quiet instead.",
    date: "2026-04-02",
    readTime: "5 min read",
    category: "Cycling",
    image: images.cyclistSoloHill,
    content: [
      "When people hear 'cycling trail,' they often picture spandex and stopwatches. Ours is closer to a long, unhurried walk on two wheels — a loop through working farmland, past tanks and tree lines, paced so a first-time rider and a seasoned one can comfortably ride together.",
      "We chose the route for what you'd see at ten kilometres an hour rather than thirty: a farmer transplanting rice, a heron working the edge of a pond, the particular gold that morning light takes on over a paddy field in February.",
      "Most guests tell us the same thing afterward — that twenty minutes in, they stopped thinking about the ride and started just looking around. That's the whole design brief, really.",
    ],
  },
  {
    slug: "planning-a-corporate-offsite-that-doesnt-feel-like-work",
    title: "Planning a Corporate Offsite That Doesn't Feel Like Work",
    excerpt:
      "The best offsites we've hosted spend less time in a conference room and more time outdoors. Here's how we structure a day.",
    date: "2026-02-20",
    readTime: "7 min read",
    category: "Corporate Retreats",
    image: images.corporateRusticMeeting,
    content: [
      "The teams that get the most out of a day at Hasiru Nidhi rarely spend it sitting down. We usually recommend front-loading the outdoors — a garden activity or cycling session first thing, while the morning is still cool — and saving indoor discussion for the part of the day when energy naturally dips.",
      "A shared, unhurried meal does more for a team than most icebreakers we've seen. Something happens when people are passing dishes around a long table that doesn't happen in a seminar room.",
      "If you're planning an offsite elsewhere, the lesson travels: build the day around a change of environment and a genuine break in routine, not just a change of address for the same meeting.",
    ],
  },
  {
    slug: "a-field-guide-to-our-bonfire-evenings",
    title: "A Field Guide to Our Bonfire Evenings",
    excerpt:
      "What actually happens after dinner, once the fire is lit and the sky opens up.",
    date: "2026-01-11",
    readTime: "4 min read",
    category: "Nature Stay",
    image: images.bonfireGroup,
    content: [
      "There's no programme for our bonfire evenings, and that's deliberate. The fire is lit shortly after dinner, chairs are arranged loosely around it, and what happens next is mostly up to the group — conversation, quiet, sometimes a guitar if a guest has brought one.",
      "On clear nights, we point out what we can of the sky. Away from city glow, the difference is immediate; guests who've never consciously looked for a constellation usually find one within a few minutes.",
      "It's a small, low-effort part of the stay, and consistently one of the most remembered. Sometimes the best design decision is simply to leave enough space for nothing scheduled to happen.",
    ],
  },
];

export const stats = [
  { value: "45", label: "Minutes from central Bengaluru" },
  { value: "12", label: "Acres of working farmland" },
  { value: "9", label: "Distinct nature experiences" },
  { value: "4.9", label: "Average guest rating" },
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
