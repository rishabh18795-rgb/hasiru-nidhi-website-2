import { z } from "zod";

export const contactSubjects = [
  "General enquiry",
  "Nature Stay",
  "Cycling",
  "Gardening",
  "Landscaping",
  "Corporate/Group visit",
  "Partnership",
  "Other",
] as const;

export const enquirySchema = z.object({
  name: z.string().min(2, "Please enter your full name."),
  phone: z.string().min(8, "Please enter a valid phone number."),
  email: z.string().email("Please enter a valid email address."),
  subject: z.string().min(1, "Let us know how we can help."),
  message: z.string().min(1, "Please add a short message.").max(1000),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
