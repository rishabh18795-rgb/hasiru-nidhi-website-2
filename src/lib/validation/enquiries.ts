import { z } from "zod";

import { emailSchema, honeypot, optionalEmail, optionalPhone, phoneSchema } from "@/lib/validation/common";

export const contactKinds = ["general", "property", "group", "experience_request", "host_partnership", "support"] as const;

export const contactEnquirySchema = z
  .object({
    kind: z.enum(contactKinds).default("general"),
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: optionalEmail,
    phone: optionalPhone,
    subject: z.string().trim().max(200).optional(),
    message: z.string().trim().min(5, "Please add a short message").max(5000),
    property_id: z.uuid().optional(),
    website: honeypot,
  })
  .refine((v) => v.email || v.phone, { path: ["email"], message: "Provide an email or a phone number so we can reply" });

export const partnerApplicationSchema = z.object({
  owner_name: z.string().trim().min(2, "Enter the owner's full name").max(120),
  email: emailSchema,
  phone: phoneSchema,
  property_name: z.string().trim().min(2, "Enter the property name").max(120),
  city: z.string().trim().min(2, "Enter the city or town").max(120),
  state: z.string().trim().min(2).max(120).default("Karnataka"),
  category: z.string().trim().max(80).optional(),
  rooms_count: z.coerce.number().int().min(1).max(200).optional(),
  max_guests: z.coerce.number().int().min(1).max(500).optional(),
  description: z.string().trim().max(3000).optional(),
  current_platforms: z.string().trim().max(300).optional(),
  partnership_model: z.string().trim().max(300).optional(),
  consent: z.literal("on", "Please accept the privacy consent to continue"),
  website: honeypot,
});

export const gardeningServices = [
  { value: "garden-design", label: "Garden design and development" },
  { value: "lawn", label: "Lawn installation and maintenance" },
  { value: "indoor-outdoor-plants", label: "Indoor and outdoor plants" },
  { value: "ornamental-plants", label: "Ornamental and premium plants" },
  { value: "balcony-terrace", label: "Balcony and terrace gardening" },
  { value: "vertical-garden", label: "Vertical gardens and green walls" },
  { value: "pots-decor", label: "Pots and garden décor" },
  { value: "plant-care", label: "Plant care and ongoing maintenance" },
] as const;

export const gardeningPropertyTypes = [
  "Independent house",
  "Villa",
  "Apartment (balcony / terrace)",
  "Farmhouse",
  "Resort / hospitality",
  "Commercial / office",
  "Other",
] as const;

export const gardeningEnquirySchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: optionalEmail,
    phone: optionalPhone,
    location: z.string().trim().min(2, "Enter the project location").max(200),
    property_type: z.enum(gardeningPropertyTypes, "Choose a property type"),
    garden_size: z.string().trim().max(80).optional(),
    services: z.array(z.enum(gardeningServices.map((s) => s.value) as [string, ...string[]])).max(20).default([]),
    requirements: z.string().trim().max(4000).optional(),
    budget_range: z.string().trim().max(80).optional(),
    website: honeypot,
  })
  .refine((v) => v.email || v.phone, { path: ["phone"], message: "Provide a phone number or an email so we can reply" });

export const reportSchema = z.object({
  property_id: z.uuid(),
  reason: z.string().trim().min(3, "Choose a reason").max(120),
  details: z.string().trim().max(3000).optional(),
});

export const ENQUIRY_PHOTO_LIMITS = {
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
} as const;
