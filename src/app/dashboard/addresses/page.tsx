import type { Metadata } from "next";

import { Card, CardTitle, EmptyState } from "@/components/app/ui";
import { AddressForm } from "@/components/checkout/address-form";
import { deleteAddress, setDefaultAddress } from "@/app/cart/actions";
import { requireUser } from "@/lib/auth";
import type { CustomerAddress } from "@/lib/db/types";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const { supabase, user } = await requireUser("/dashboard/addresses");
  const { data } = await supabase.from("customer_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at");
  const addresses = (data ?? []) as CustomerAddress[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Delivery addresses</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Saved for checkout. Each order keeps its own copy of the address, so changing or deleting one here never changes an order you already placed.</p>
      </div>
      {addresses.length === 0 ? <EmptyState title="No saved addresses" description="Add one below, or during checkout." /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-forest-950">{a.label || a.full_name}{a.is_default ? <span className="ml-2 rounded-full bg-forest-100 px-2 py-0.5 text-xs text-forest-800">Default</span> : null}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/75">{a.full_name}, {a.phone}<br />{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}<br />{a.city}, {a.state} {a.postal_code}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {!a.is_default ? <form action={setDefaultAddress.bind(null, a.id)}><button type="submit" className="text-forest-700 underline">Make default</button></form> : null}
                  <form action={deleteAddress.bind(null, a.id)}><button type="submit" className="text-red-700 underline">Delete</button></form>
                </div>
                <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-forest-800">Edit</summary><div className="mt-4"><AddressForm address={a} submitLabel="Save changes" /></div></details>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card><CardTitle>Add an address</CardTitle><AddressForm submitLabel="Add address" defaultChecked={addresses.length === 0} /></Card>
    </div>
  );
}
