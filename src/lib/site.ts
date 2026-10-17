import { siteUrl } from "@/lib/base-path";

function configured(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const siteConfig = {
  name: "Hasiru Nidhi",
  legalName: "Hasiru Nidhi Horizons Private Limited",
  tagline: "Cultivating Nature, Creating Memories",
  description:
    "A nature experience retreat in the hills off Kanakapura Road, Bengaluru — cycling trails, working gardens, farmhouse stays, and slow, unhurried days spent outdoors.",
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
    // Contact channels come from environment configuration. They are intentionally EMPTY by
    // default: this project never invents a business phone number or e-mail address.
    phone: configured("NEXT_PUBLIC_CONTACT_PHONE"),
    phoneDisplay: configured("NEXT_PUBLIC_CONTACT_PHONE"),
    email: configured("NEXT_PUBLIC_CONTACT_EMAIL"),
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
  { label: "Home", href: "/" },
  { label: "Explore Stays", href: "/stays" },
  {
    label: "Experiences",
    href: "/experiences",
    children: [
      { label: "All Experiences", href: "/experiences" },
      { label: "Nature Stay", href: "/nature-stay" },
      { label: "Cycling & Outdoors", href: "/cycling" },
      { label: "Gardening & Landscaping", href: "/gardening-landscaping" },
      { label: "Gardening Experiences", href: "/gardening" },
      { label: "Landscaping & Grounds", href: "/landscaping" },
    ],
  },
  {
    label: "Plan",
    href: "/packages",
    children: [
      { label: "Packages", href: "/packages" },
      { label: "Pricing", href: "/pricing" },
      { label: "Book Your Experience", href: "/book" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "About Hasiru Nidhi", href: "/about" },
      { label: "Gallery", href: "/gallery" },
      { label: "Journal", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const;

export const footerLinks = {
  explore: [
    { label: "Explore Stays", href: "/stays" },
    { label: "Experiences", href: "/experiences" },
    { label: "Cycling & Outdoors", href: "/cycling" },
    { label: "Gardening & Landscaping", href: "/gardening-landscaping" },
    { label: "Gallery", href: "/gallery" },
    { label: "The Journal", href: "/blog" },
  ],
  plan: [
    { label: "Book Your Experience", href: "/book" },
    { label: "Packages", href: "/packages" },
    { label: "Pricing", href: "/pricing" },
    { label: "List Your Property", href: "/list-your-property" },
    { label: "Become a Host", href: "/become-a-host" },
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
