"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  kind: z.enum(["product", "service"]),
  ref: z.uuid(),
  rating: z.coerce.number({ error: "Choose a rating" }).int().min(1, "Choose a rating").max(5),
  title: z.preprocess((v) => v ?? "", z.string().trim().max(100, "Keep the title under 100 characters")),
  body: z.string().trim().min(10, "Please write at least 10 characters").max(2000, "Keep it under 2000 characters"),
  back: z.string().regex(/^\/dashboard\/(orders|requests)\/[0-9a-f-]{36}$/),
});

/** The database decides eligibility (delivered order line or completed service, own purchase, once only); this validates the text. */
export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session || session.profile.is_suspended) return { ok: false, message: "Please sign in to continue." };
  const raw = formValues(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const d = parsed.data;
  const { error } = await session.supabase.rpc("submit_marketplace_review", { p_kind: d.kind, p_ref: d.ref, p_rating: d.rating, p_title: d.title || null, p_body: d.body });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath(d.back);
  return { ok: true, message: "Thank you. Your review was sent to our team and will appear once it has been checked.", values: {} };
}
