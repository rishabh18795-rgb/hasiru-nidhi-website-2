"use server";

import { randomUUID } from "node:crypto";

import { formValues, zodFieldErrors, type FormState } from "@/lib/action";
import { ENQUIRY_PHOTO_LIMITS, gardeningEnquirySchema } from "@/lib/validation/enquiries";
import { recordEnquiry } from "@/lib/data/enquiries";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface UploadTicket {
  path: string;
  token: string;
}

/**
 * Mints one-time signed upload URLs so the browser can send photos DIRECTLY to the private
 * 'enquiry-photos' bucket (bypassing the serverless request-size limit). The service-role key
 * never leaves the server; type, size and count limits are enforced here and by the bucket.
 */
export async function createEnquiryUploadTickets(
  files: { type: string; size: number }[],
): Promise<{ ok: true; tickets: UploadTicket[] } | { ok: false; message: string }> {
  if (!isServiceRoleConfigured()) return { ok: false, message: "Photo upload isn't available right now. You can send the form without photos and share them with us afterwards." };
  if (files.length === 0 || files.length > ENQUIRY_PHOTO_LIMITS.maxFiles) return { ok: false, message: `Attach between 1 and ${ENQUIRY_PHOTO_LIMITS.maxFiles} photos.` };
  for (const f of files) {
    if (!EXT[f.type]) return { ok: false, message: "Photos must be JPEG, PNG or WebP." };
    if (f.size > ENQUIRY_PHOTO_LIMITS.maxBytes) return { ok: false, message: "Each photo must be under 5 MB." };
  }
  if (!(await withinRateLimit("upload"))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const admin = createAdminSupabase();
  const folder = randomUUID();
  const tickets: UploadTicket[] = [];
  for (const f of files) {
    const path = `incoming/${folder}/${randomUUID()}.${EXT[f.type]}`;
    const { data, error } = await admin.storage.from("enquiry-photos").createSignedUploadUrl(path);
    if (error || !data) return { ok: false, message: "Couldn't prepare the upload. Please try again." };
    tickets.push({ path, token: data.token });
  }
  return { ok: true, tickets };
}

const PHOTO_PATH = /^incoming\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function submitGardeningEnquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  if (values.website) return { ok: true, message: "Thank you — we'll be in touch." };
  const parsed = gardeningEnquirySchema.safeParse({ ...values, services: formData.getAll("services").map(String) });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values };
  const v = parsed.data;
  // Only paths that look exactly like our signed-upload output are stored.
  const photo_paths = formData.getAll("photo_path").map(String).filter((p) => PHOTO_PATH.test(p)).slice(0, ENQUIRY_PHOTO_LIMITS.maxFiles);

  const result = await recordEnquiry(
    "gardening_enquiries",
    {
      name: v.name, email: v.email ?? null, phone: v.phone ?? null, location: v.location, property_type: v.property_type,
      garden_size: v.garden_size || null, services: v.services, requirements: v.requirements || null,
      budget_range: v.budget_range || null, photo_paths,
    },
    `New gardening quote request from ${v.name}`,
    `Location: ${v.location}\nProperty: ${v.property_type}\nSize: ${v.garden_size ?? "-"}\nBudget: ${v.budget_range ?? "-"}\nServices: ${v.services.join(", ") || "-"}\nContact: ${v.email ?? ""} ${v.phone ?? ""}\n\n${v.requirements ?? ""}\n\nPhotos: ${photo_paths.length}. Manage in Admin > Enquiries.`,
  );
  return result.ok
    ? { ok: true, message: "Thank you — your quote request is with our team. We'll contact you to discuss the project." }
    : { ok: false, message: result.error, values };
}
