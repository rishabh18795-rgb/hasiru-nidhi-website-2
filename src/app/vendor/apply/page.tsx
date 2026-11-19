import { redirect } from "next/navigation";

// A friendly alias: everything about applying lives on the profile page.
export default function VendorApplyRedirect() {
  redirect("/vendor/profile");
}
