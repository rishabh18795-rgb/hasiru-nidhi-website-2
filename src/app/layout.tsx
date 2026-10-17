import type { Metadata, Viewport } from "next";

import { fraunces, manrope } from "@/lib/fonts";
import { siteConfig } from "@/lib/site";
import { basePath, siteOrigin } from "@/lib/base-path";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { getPublicSettings } from "@/lib/data/catalog";
import "./globals.css";

export const metadata: Metadata = {
  // Pages declare their own relative `alternates.canonical`; metadataBase resolves them
  // against NEXT_PUBLIC_SITE_URL (see src/lib/base-path.ts).
  metadataBase: new URL(siteOrigin),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.legalName }],
  creator: siteConfig.legalName,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: `${siteConfig.url}/`,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [{ url: `${siteConfig.url}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [`${siteConfig.url}/opengraph-image`],
  },
  icons: {
    icon: `${basePath}/brand/logo-mark.png`,
    apple: `${basePath}/brand/logo-mark.png`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#163a26",
  width: "device-width",
  initialScale: 1,
};

const socialLinks = [
  siteConfig.social.instagram,
  siteConfig.social.facebook,
  siteConfig.social.youtube,
].filter(Boolean);

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TouristAttraction",
      "@id": `${siteConfig.url}/#attraction`,
      name: siteConfig.legalName,
      alternateName: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      ...(siteConfig.contact.phone ? { telephone: siteConfig.contact.phone } : {}),
      ...(siteConfig.contact.email ? { email: siteConfig.contact.email } : {}),
      image: `${siteConfig.url}/opengraph-image`,
      address: {
        "@type": "PostalAddress",
        streetAddress: `${siteConfig.contact.address.line1}, ${siteConfig.contact.address.line2}`,
        addressLocality: siteConfig.contact.address.city,
        addressRegion: siteConfig.contact.address.state,
        postalCode: siteConfig.contact.address.postalCode,
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: siteConfig.contact.coordinates.lat,
        longitude: siteConfig.contact.coordinates.lng,
      },
      sameAs: socialLinks,
    },
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.legalName,
      alternateName: siteConfig.name,
      url: siteConfig.url,
      logo: `${siteConfig.url}/brand/logo-mark.png`,
      ...(siteConfig.contact.email ? { email: siteConfig.contact.email } : {}),
      ...(siteConfig.contact.phone ? { telephone: siteConfig.contact.phone } : {}),
      sameAs: socialLinks,
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { announcement } = await getPublicSettings();
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-ink font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Navbar announcement={announcement || undefined} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
