"use client";

import { useActionState } from "react";

import { saveCoverage } from "@/app/vendor/actions";
import type { FormState } from "@/lib/action";
import { Field, TextArea } from "@/components/forms/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: FormState = {};

export function CoverageForm({ scope, title, help, current }: { scope: "delivery" | "service"; title: string; help: string; current: string[] }) {
  const [state, action] = useActionState(saveCoverage, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="scope" value={scope} />
      <FormMessage state={state} />
      <Field label={title} htmlFor={`pins-${scope}`} hint={help}>
        <TextArea id={`pins-${scope}`} name="pins" rows={4} defaultValue={state.values?.pins ?? current.join(", ")} placeholder="560078, 560001, 562" />
      </Field>
      <SubmitButton pendingLabel="Saving…" className="self-start">Save {scope === "delivery" ? "delivery" : "service"} coverage</SubmitButton>
    </form>
  );
}
