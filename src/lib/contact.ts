import { siteConfig } from "@/lib/site";

/** wa.me link with an optional pre-filled message. Returns null when no number is configured. */
export function whatsappLink(number: string | null | undefined, message?: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function telHref(phone: string | null | undefined): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return cleaned.length >= 8 ? `tel:${cleaned}` : null;
}

export type WhatsAppTopic = "general" | "property" | "gardening" | "group" | "partner";

const TOPIC_MESSAGE: Record<WhatsAppTopic, string> = {
  general: "Hello Hasiru Nidhi, I have a question about visiting.",
  property: "Hello Hasiru Nidhi, I'd like to enquire about a stay.",
  gardening: "Hello Hasiru Nidhi, I'd like a gardening / landscaping consultation.",
  group: "Hello Hasiru Nidhi, I'm planning a group outing or cycling experience.",
  partner: "Hello Hasiru Nidhi, I'd like to list my property with you.",
};

export function whatsappMessage(topic: WhatsAppTopic, detail?: string): string {
  return detail ? `${TOPIC_MESSAGE[topic]} (${detail})` : TOPIC_MESSAGE[topic];
}

/** Environment value only (works in any component). Admin-editable value is layered on in data/settings.ts. */
export function envWhatsappNumber(): string {
  return siteConfig.contact.whatsappNumber;
}
