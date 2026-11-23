"use client";

import { useActionState } from "react";

import { saveProduct } from "@/app/vendor/product-actions";
import type { FormState } from "@/lib/action";
import type { Product, ProductCategory } from "@/lib/db/types";
import { attributesToText } from "@/lib/validation/product";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function ProductForm({ product, categories, locked }: { product: Product | null; categories: ProductCategory[]; locked?: boolean }) {
  const [state, action] = useActionState(saveProduct, initial);
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2 disabled:opacity-70">
        <Field label="Product name" htmlFor="name" required error={err("name")} className="sm:col-span-2">
          <TextInput id="name" name="name" defaultValue={v("name", product?.name ?? "")} maxLength={120} error={Boolean(err("name"))} />
        </Field>
        <Field label="Category" htmlFor="category_id" required error={err("category_id")}>
          <NativeSelect id="category_id" name="category_id" defaultValue={v("category_id", String(product?.category_id ?? ""))} error={Boolean(err("category_id"))}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Brand (optional)" htmlFor="brand" error={err("brand")}>
          <TextInput id="brand" name="brand" defaultValue={v("brand", product?.brand ?? "")} maxLength={80} />
        </Field>
        <Field label="Short summary" htmlFor="summary" hint="One or two sentences shown on product cards (up to 240 characters)." error={err("summary")} className="sm:col-span-2">
          <TextInput id="summary" name="summary" defaultValue={v("summary", product?.summary ?? "")} maxLength={240} />
        </Field>
        <Field label="Description" htmlFor="description" hint="Describe what it is, how it is grown or made, how to use or care for it. At least 30 characters to submit. Only claim what is true." error={err("description")} className="sm:col-span-2">
          <TextArea id="description" name="description" rows={6} defaultValue={v("description", product?.description ?? "")} maxLength={8000} />
        </Field>
        <Field label="Specifications" htmlFor="specifications" hint={'One per line, as "Label: value". For example "Height: 20 cm" or "Ingredients: neem cake". Up to 20.'} error={err("specifications")} className="sm:col-span-2">
          <TextArea id="specifications" name="specifications" rows={5} defaultValue={v("specifications", attributesToText(product?.attributes))} placeholder={"Height: 20 cm\nPot: biodegradable"} />
        </Field>
      </fieldset>
      {!locked ? <SubmitButton pendingLabel="Saving…" className="self-start">{product ? "Save details" : "Create draft"}</SubmitButton> : null}
      {product?.status === "approved" ? <p className="text-xs text-ink/65">This product is approved. Saving changes to its name, category, description, brand or specifications sends it back for review and hides it until it is approved again.</p> : null}
    </form>
  );
}
