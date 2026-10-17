import Link from "next/link";

import { siteConfig } from "@/lib/site";

/** Inline contact reference for legal/FAQ prose: the real e-mail if configured, else the contact form. */
export function ContactEmailLink() {
  const email = siteConfig.contact.email;
  return email ? (
    <a href={`mailto:${email}`} className="underline underline-offset-2">
      {email}
    </a>
  ) : (
    <Link href="/contact" className="underline underline-offset-2">
      our contact form
    </Link>
  );
}

export function ContactPhoneSuffix({ prefix = "or call" }: { prefix?: string }) {
  const phone = siteConfig.contact.phone;
  return phone ? <> {prefix} {siteConfig.contact.phoneDisplay}</> : null;
}
