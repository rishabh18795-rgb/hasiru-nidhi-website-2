export const siteConfig = {
  name: "Hasiru Nidhi",
  legalName: "Hasiru Nidhi Horizons Private Limited",
  tagline: "Cultivating Nature, Creating Memories",
  description:
    "A nature experience retreat in the hills off Kanakapura Road, Bengaluru — cycling trails, working gardens, farmhouse stays, and slow, unhurried days spent outdoors.",
  url: "https://www.hasirunidhi.com",
  ogImage: "/og/hasiru-nidhi-cover.jpg",
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
    phone: "+91 98450 12345",
    phoneDisplay: "+91 98450 12345",
    email: "stay@hasirunidhi.com",
    whatsapp: "https://wa.me/919845012345",
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
    instagram: "https://instagram.com/hasirunidhi",
    facebook: "https://facebook.com/hasirunidhi",
    youtube: "https://youtube.com/@hasirunidhi",
    pinterest: "https://pinterest.com/hasirunidhi",
  },
  hours: {
    dayVisit: "9:00 AM – 6:00 PM, all days",
    checkIn: "2:00 PM",
    checkOut: "11:00 AM",
  },
} as const;

export const navLinks = [
  { label: "Home", href: "/" },
  {
    label: "Experiences",
    href: "/experiences",
    children: [
      { label: "All Experiences", href: "/experiences" },
      { label: "Nature Stay", href: "/nature-stay" },
      { label: "Cycling", href: "/cycling" },
      { label: "Gardening Services", href: "/gardening" },
      { label: "Landscaping", href: "/landscaping" },
    ],
  },
  { label: "About", href: "/about" },
  { label: "Gallery", href: "/gallery" },
  { label: "Packages", href: "/packages" },
  { label: "Pricing", href: "/pricing" },
  { label: "Journal", href: "/blog" },
  { label: "Contact", href: "/contact" },
] as const;

export const footerLinks = {
  explore: [
    { label: "About Hasiru Nidhi", href: "/about" },
    { label: "Experiences", href: "/experiences" },
    { label: "Gallery", href: "/gallery" },
    { label: "The Journal", href: "/blog" },
  ],
  plan: [
    { label: "Packages", href: "/packages" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
  ],
} as const;
