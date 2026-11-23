"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";

const schema = z.object({ review_id: z.uuid(), decision: z.enum(["approve", "reject"]), note: z.preprocess((v) => v ?? "", z.string().trim().max(500)) });

export async function moderateReview(_prev: FormState, formData: FormData): Promise<FormState> {
  let session;
  try { session = await assertRole(["admin"]); } catch (e) { if (e instanceof AuthorizationError) return { ok: false, message: "Administrator access is required." }; throw e; }
  const raw = formValues(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose a decision.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const { error } = await session.supabase.rpc("admin_moderate_marketplace_review", { p_review: parsed.data.review_id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/admin/marketplace-reviews");
  revalidatePath("/shop", "layout");
  revalidatePath("/services", "layout");
  return { ok: true, message: parsed.data.decision === "approve" ? "Approved: it is now public." : "Not published.", values: {} };
}
