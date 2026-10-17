import { MessageCircle } from "lucide-react";

import { getPublicSettings } from "@/lib/data/catalog";
import { whatsappLink, whatsappMessage, type WhatsAppTopic } from "@/lib/contact";
import { cn } from "@/lib/utils";

/**
 * Pre-filled WhatsApp enquiry link. Renders NOTHING until the owner has configured an official
 * business number (env NEXT_PUBLIC_WHATSAPP_NUMBER or Admin > Settings) — no invented numbers.
 */
export async function WhatsAppButton({
  topic,
  detail,
  label = "Chat on WhatsApp",
  className,
}: {
  topic: WhatsAppTopic;
  detail?: string;
  label?: string;
  className?: string;
}) {
  const { whatsapp_number } = await getPublicSettings();
  const href = whatsappLink(whatsapp_number, whatsappMessage(topic, detail));
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border border-forest-900/25 bg-white px-6 text-sm font-medium text-forest-900 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}
