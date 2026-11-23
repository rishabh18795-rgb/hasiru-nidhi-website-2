"use client";

import { useActionState } from "react";

import { adjustInventory, saveVariant } from "@/app/vendor/product-actions";
import type { FormState } from "@/lib/action";
import type { ProductVariant } from "@/lib/db/types";
import { INVENTORY_REASONS, optionsToText } from "@/lib/validation/product";
import { formatPrice } from "@/lib/format";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

function VariantForm({ productId, variant, onlyIfEditable }: { productId: string; variant?: ProductVariant; onlyIfEditable: boolean }) {
  const [state, action] = useActionState(saveVariant, initial);
  const id = variant?.id ?? "new";
  const err = (k: string) => state.fieldErrors?.[k];
  const val = (k: string, fallback: string) => (state.ok ? fallback : state.values?.[k] ?? fallback);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <input type="hidden" name="product_id" value={productId} />
      {variant ? <input type="hidden" name="id" value={variant.id} /> : null}
      <Field label="Variant name" htmlFor={`vn-${id}`} required error={err("name")} hint="What shoppers see, e.g. “6 inch pot” or “500 g pack”."><TextInput id={`vn-${id}`} name="name" defaultValue={val("name", variant?.name ?? "")} maxLength={120} /></Field>
      <Field label="SKU" htmlFor={`sku-${id}`} required error={err("sku")} hint="Your own code. Unique within this product."><TextInput id={`sku-${id}`} name="sku" defaultValue={val("sku", variant?.sku ?? "")} maxLength={40} /></Field>
      <Field label="Price (₹)" htmlFor={`pr-${id}`} required error={err("price_inr")} hint="The price shoppers pay for one. Taxes and delivery fees are not configured yet."><TextInput id={`pr-${id}`} name="price_inr" inputMode="decimal" defaultValue={val("price_inr", variant ? String(variant.price_inr) : "")} /></Field>
      <Field label="Weight in grams (optional)" htmlFor={`wt-${id}`} error={err("weight_grams")}><TextInput id={`wt-${id}`} name="weight_grams" inputMode="numeric" defaultValue={val("weight_grams", variant?.weight_grams ? String(variant.weight_grams) : "")} /></Field>
      <Field label="Options (optional)" htmlFor={`op-${id}`} error={err("options")} className="sm:col-span-2" hint={'One per line, e.g. "Size: Medium", "Pot size: 6 inch", "Pack quantity: 2". Up to 5.'}>
        <TextArea id={`op-${id}`} name="options" rows={3} defaultValue={val("options", optionsToText(variant?.options))} />
      </Field>
      {!variant ? (
        <Field label="Opening stock" htmlFor={`st-${id}`} error={err("initial_stock")} hint="Recorded in the stock history. Change it later with “Adjust stock”."><TextInput id={`st-${id}`} name="initial_stock" inputMode="numeric" defaultValue={val("initial_stock", "0")} /></Field>
      ) : null}
      <div className="flex flex-col justify-end gap-2 text-sm text-ink/80">
        <label className="flex items-center gap-2"><input type="checkbox" name="track_inventory" defaultChecked={variant?.track_inventory ?? true} className="h-4 w-4 accent-forest-700" /> Track stock for this variant</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={variant?.is_active ?? true} className="h-4 w-4 accent-forest-700" /> Offer this variant to shoppers</label>
      </div>
      {onlyIfEditable ? <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">{variant ? "Save variant" : "Add variant"}</SubmitButton></div> : null}
    </form>
  );
}

function AdjustForm({ variant, productId }: { variant: ProductVariant; productId: string }) {
  const [state, action] = useActionState(adjustInventory, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-forest-50/60 p-3">
      <input type="hidden" name="variant_id" value={variant.id} />
      <input type="hidden" name="product_id" value={productId} />
      <label className="text-xs text-ink/70">Method
        <NativeSelect name="mode" defaultValue="add" className="mt-1 h-9 text-sm"><option value="add">Add or remove</option><option value="set">Set to exactly</option></NativeSelect>
      </label>
      <label className="text-xs text-ink/70">Quantity
        <TextInput name="quantity" inputMode="numeric" className="mt-1 h-9 w-24 text-sm" placeholder="e.g. 10 or -2" aria-label={`Quantity for ${variant.name}`} />
      </label>
      <label className="text-xs text-ink/70">Reason
        <NativeSelect name="reason" defaultValue="restock" className="mt-1 h-9 text-sm">{Object.entries(INVENTORY_REASONS).filter(([k]) => k !== "initial").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</NativeSelect>
      </label>
      <label className="min-w-32 flex-1 text-xs text-ink/70">Note (optional)
        <TextInput name="note" maxLength={300} className="mt-1 h-9 text-sm" />
      </label>
      <SubmitButton variant="outline" pendingLabel="…" className="h-9 px-4">Adjust stock</SubmitButton>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={`w-full text-xs ${state.ok ? "text-forest-700" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}

export function VariantManager({ productId, variants, editable }: { productId: string; variants: ProductVariant[]; editable: boolean }) {
  return (
    <div className="space-y-4">
      {variants.length === 0 ? <p className="rounded-xl border border-dashed border-forest-900/20 px-4 py-6 text-center text-sm text-ink/65">No variants yet. Add at least one with a price, so shoppers know what they are buying.</p> : null}
      {variants.map((v) => (
        <details key={v.id} className="rounded-2xl border border-forest-900/10 bg-white p-4">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
            <span>
              <span className="font-medium text-forest-950">{v.name}</span>
              <span className="ml-2 text-xs text-ink/65">SKU {v.sku}</span>
              {!v.is_active ? <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">Not offered</span> : null}
            </span>
            <span className="flex items-center gap-4 text-sm"><span className="font-display text-lg text-forest-950">{formatPrice(v.price_inr)}</span>
              <span className={v.track_inventory && v.stock_on_hand === 0 ? "text-red-700" : "text-ink/70"}>{v.track_inventory ? `${v.stock_on_hand} in stock` : "Stock not tracked"}</span>
              <span className="text-xs font-medium text-forest-700 underline underline-offset-2">Manage</span></span>
          </summary>
          <div className="mt-4 border-t border-forest-900/10 pt-4">
            {v.track_inventory ? <AdjustForm variant={v} productId={productId} /> : null}
            <div className="mt-4"><VariantForm productId={productId} variant={v} onlyIfEditable={editable} /></div>
            {!editable ? <p className="mt-2 text-xs text-ink/65">Variant details can&apos;t be edited while the product is in this state. Stock can still be adjusted.</p> : null}
          </div>
        </details>
      ))}
      {editable ? (
        <details className="rounded-2xl border border-forest-900/10 bg-forest-50/40 p-4" open={variants.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-forest-900">Add a variant</summary>
          <div className="mt-4"><VariantForm productId={productId} onlyIfEditable /></div>
        </details>
      ) : null}
    </div>
  );
}
