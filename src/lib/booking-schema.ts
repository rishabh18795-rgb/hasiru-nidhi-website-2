import { z } from "zod";

export const experienceTypes = [
  { value: "nature-stay", label: "Nature Stay" },
  { value: "cycling", label: "Cycling" },
  { value: "gardening", label: "Gardening" },
  { value: "landscaping", label: "Landscaping" },
  { value: "multiple", label: "Multiple Experiences" },
  { value: "not-sure", label: "Not Sure — Help Me Choose" },
] as const;

export const stayTypes = [
  { value: "farmhouse-room", label: "Farmhouse Room" },
  { value: "cottage", label: "Cottage" },
  { value: "not-sure", label: "Not Sure" },
] as const;

export const bookingSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name."),
  phone: z.string().min(8, "Please enter a valid phone number."),
  email: z.string().email("Please enter a valid email address."),
  preferredDate: z.string().min(1, "Let us know your preferred date."),
  adults: z.string().min(1, "Let us know how many adults are coming."),
  children: z.string().optional(),
  experienceType: z.string().min(1, "Select what you'd like to experience."),
  stayType: z.string().optional(),
  projectType: z.string().optional(),
  projectLocation: z.string().optional(),
  projectSize: z.string().optional(),
  message: z.string().max(1000).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
