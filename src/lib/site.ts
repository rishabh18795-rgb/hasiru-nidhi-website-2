import { siteUrl } from "@/lib/base-path";

function configured(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** The official business mailbox, confirmed by the owner (24 Nov 2026). NEXT_PUBLIC_CONTACT_EMAIL overrides it (for example once a domain mailbox exists). */
export const OFFICIAL_EMAIL = "hasirunidhiofficial@gmail.com";

export const siteConfig = {
  name: "Hasiru Nidhi",
  legalName: "Hasiru Nidhi Horizons Private Limited",
  tagline: "Cultivating Nature, Creating Memories",
  description:
    "Find peaceful nature stays: farm stays, cottages and eco-retreats. Search by PIN code, see the full price and send a booking request. Owners can list their stay.",
  // Set NEXT_PUBLIC_SITE_URL to the production domain once it is connected.
  url: siteUrl,
  locale: "en_IN",
  keywords: [
    "nature resort Bengaluru",
    "farm stay Karnataka",
    "eco tourism near Bangalore",
    "cycling retreat",
    "organic farm experience",
    "corporate offsite Bengaluru",
    "weekend getaway Kanakapura",
    "sustainable tourism India",
  ],
  contact: {
    // The phone number comes from environment configuration and is intentionally EMPTY by default: this project never invents a
    // business phone number. The e-mail is the owner-confirmed official address, overridable by environment.
    phone: configured("NEXT_PUBLIC_CONTACT_PHONE"),
    phoneDisplay: configured("NEXT_PUBLIC_CONTACT_PHONE"),
    email: configured("NEXT_PUBLIC_CONTACT_EMAIL") || OFFICIAL_EMAIL,
    // Digits only, with country code (e.g. 9198XXXXXXXX). Admins can also set it in Admin > Settings.
    whatsappNumber: configured("NEXT_PUBLIC_WHATSAPP_NUMBER").replace(/\D/g, ""),
    address: {
      line1: "Hasiru Nidhi Nature Grounds",
      line2: "Off Kanakapura Road, Harohalli",
      city: "Bengaluru Rural",
      state: "Karnataka",
      postalCode: "562112",
      country: "India",
    },
    mapUrl: "https://maps.google.com/?q=Harohalli,Karnataka",
    coordinates: { lat: 12.6167, lng: 77.4333 },
  },
  social: {
    // Only configured profiles are shown or emitted in structured data.
    instagram: configured("NEXT_PUBLIC_INSTAGRAM_URL"),
    facebook: configured("NEXT_PUBLIC_FACEBOOK_URL"),
    youtube: configured("NEXT_PUBLIC_YOUTUBE_URL"),
    pinterest: "",
  },
  hours: {
    dayVisit: "9:00 AM – 6:00 PM, all days",
    checkIn: "2:00 PM",
    checkOut: "11:00 AM",
  },
} as const;

export const navLinks = [
  { label: "Explore Stays", href: "/stays" },
  { label: "Nature Stay", href: "/nature-stay" },
  {
    label: "Experiences",
    href: "/experiences",
    children: [
      { label: "All Experiences", href: "/experiences" },
      { label: "Cycling & Outdoors", href: "/cycling" },
      { label: "Gallery", href: "/gallery" },
    ],
  },
  {
    label: "Plan",
    href: "/packages",
    children: [
      { label: "Packages", href: "/packages" },
      { label: "Pricing", href: "/pricing" },
      { label: "Farm Visit Enquiry", href: "/book" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    label: "Gardening Services",
    href: "/gardening-landscaping",
    children: [
      { label: "Gardening & Landscaping", href: "/gardening-landscaping" },
      { label: "Gardening Experiences", href: "/gardening" },
      { label: "Landscaping & Grounds", href: "/landscaping" },
    ],
  },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "About Hasiru Nidhi", href: "/about" },
      { label: "Journal", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const;

export const footerLinks = {
  explore: [
    { label: "Explore Stays", href: "/stays" },
    { label: "Nature Stay", href: "/nature-stay" },
    { label: "Experiences", href: "/experiences" },
    { label: "Cycling & Outdoors", href: "/cycling" },
    { label: "Gallery", href: "/gallery" },
    { label: "The Journal", href: "/blog" },
  ],
  plan: [
    { label: "Packages", href: "/packages" },
    { label: "Pricing", href: "/pricing" },
    { label: "Farm Visit Enquiry", href: "/book" },
    { label: "Gardening Services", href: "/gardening-landscaping" },
    { label: "Become a Host", href: "/become-a-host" },
    { label: "List Your Property", href: "/list-your-property" },
    { label: "About Hasiru Nidhi", href: "/about" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Cancellation & Refunds", href: "/cancellation-policy" },
  ],
} as const;
