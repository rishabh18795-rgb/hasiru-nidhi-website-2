"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { formValues, zodFieldErrors, type FormState } from "@/lib/action";
import { partnerApplicationSchema } from "@/lib/validation/enquiries";
import { recordEnquiry } from "@/lib/data/enquiries";

/** Creates a persistent partner_applications record (never just a browser-side success message). */
export async function submitPartnerApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  if (values.website) return { ok: true, message: "Thank you — we'll be in touch." };
  const parsed = partnerApplicationSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values };
  const v = parsed.data;
  const result = await recordEnquiry(
    "partner_applications",
    {
      owner_name: v.owner_name, email: v.email, phone: v.phone, property_name: v.property_name, city: v.city, state: v.state,
      category: v.category || null, rooms_count: v.rooms_count ?? null, max_guests: v.max_guests ?? null,
      description: v.description || null, current_platforms: v.current_platforms || null,
      partnership_model: v.partnership_model || null, consent_at: new Date().toISOString(),
    },
    `New partner application: ${v.property_name}`,
    `${v.owner_name} (${v.phone}, ${v.email}) wants to list "${v.property_name}" in ${v.city}, ${v.state}.\n\nManage in Admin > Enquiries > Partner applications.`,
  );
  return result.ok
    ? { ok: true, message: "Application received. Our partnerships team will contact you to discuss next steps. Creating a host account lets you add photographs and track your listing's status." }
    : { ok: false, message: result.error, values };
}

/** Turns a signed-in traveller account into a host account (never an admin) and starts the listing wizard. */
export async function becomeHost(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=%2Flist-your-property");
  const { error } = await session.supabase.rpc("become_host");
  if (error) redirect("/list-your-property?error=become_host");
  revalidatePath("/", "layout");
  redirect("/host/properties/new");
}
