import Link from "next/link";
import Image from "next/image";
import { MapPin, Mail, Phone } from "lucide-react";

import { footerLinks, siteConfig } from "@/lib/site";
import { basePath } from "@/lib/base-path";
import { InstagramIcon, FacebookIcon, YoutubeIcon } from "@/components/site/social-icons";

export function Footer() {
  return (
    <footer className="bg-forest-950 text-cream">
      <div className="container-nidhi grid gap-14 py-20 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={`${basePath}/brand/logo-mark.png`}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
            />
            <span className="font-display text-2xl text-cream">Hasiru Nidhi</span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/60">
            {siteConfig.tagline} — a nature experience retreat off Kanakapura
            Road, Bengaluru. Cycling, gardening, farmhouse stays and slow days
            outdoors.
          </p>
          <div className="mt-6 flex gap-3">
            {[
              { icon: InstagramIcon, href: siteConfig.social.instagram, label: "Instagram" },
              { icon: FacebookIcon, href: siteConfig.social.facebook, label: "Facebook" },
              { icon: YoutubeIcon, href: siteConfig.social.youtube, label: "YouTube" },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/15 text-cream/70 transition-colors hover:border-sand-400 hover:text-sand-300"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-eyebrow text-sand-400">Explore</p>
          <ul className="mt-5 flex flex-col gap-3">
            {footerLinks.explore.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-cream/65 transition-colors hover:text-cream"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-eyebrow text-sand-400">Plan Your Visit</p>
          <ul className="mt-5 flex flex-col gap-3">
            {footerLinks.plan.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-cream/65 transition-colors hover:text-cream"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-eyebrow text-sand-400">Visit Us</p>
          <ul className="mt-5 flex flex-col gap-3 text-sm text-cream/65">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sand-400" />
              <span>
                {siteConfig.contact.address.line1}, {siteConfig.contact.address.line2},{" "}
                {siteConfig.contact.address.city}, {siteConfig.contact.address.state}{" "}
                {siteConfig.contact.address.postalCode}
              </span>
            </li>
            <li className="flex gap-3">
              <Phone className="h-4 w-4 shrink-0 text-sand-400" />
              <a href={`tel:${siteConfig.contact.phone.replace(/\s/g, "")}`} className="hover:text-cream">
                {siteConfig.contact.phoneDisplay}
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="h-4 w-4 shrink-0 text-sand-400" />
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-cream">
                {siteConfig.contact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="container-nidhi flex flex-col gap-3 py-6 text-xs text-cream/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.
          </p>
          <div className="flex gap-6">
            {footerLinks.legal.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-cream/80">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
