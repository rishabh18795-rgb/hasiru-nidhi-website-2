import { z } from "zod";

export const enquirySchema = z.object({
  name: z.string().min(2, "Please enter your full name."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().min(8, "Please enter a valid phone number."),
  groupSize: z.string().min(1, "Let us know how many are coming."),
  preferredDate: z.string().min(1, "Let us know your preferred date."),
  interest: z.string().min(1, "Select what you're enquiring about."),
  message: z.string().max(1000).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
