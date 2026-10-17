import * as React from "react";

import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-xl border border-forest-900/15 bg-white px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus-visible:border-forest-500 focus-visible:ring-3 focus-visible:ring-forest-500/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-forest-950">
        {label}
        {required ? <span aria-hidden="true" className="text-red-600"> *</span> : null}
      </label>
      {children}
      {hint && !error?.length ? <p className="text-xs text-ink/55">{hint}</p> : null}
      {error?.length ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-600">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, error, ...props }: React.ComponentProps<"input"> & { error?: boolean }) {
  return (
    <input
      className={cn(controlClass, "h-11", className)}
      aria-invalid={error || undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function TextArea({ className, error, ...props }: React.ComponentProps<"textarea"> & { error?: boolean }) {
  return (
    <textarea
      className={cn(controlClass, "min-h-28 py-2.5", className)}
      aria-invalid={error || undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function NativeSelect({
  className,
  error,
  children,
  ...props
}: React.ComponentProps<"select"> & { error?: boolean }) {
  return (
    <select
      className={cn(controlClass, "h-11 appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23163a26' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      aria-invalid={error || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  value = "on",
  error,
  id,
}: {
  name: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
  value?: string;
  error?: string[];
  id?: string;
}) {
  const inputId = id ?? `${name}-${value}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink/80">
        <input
          id={inputId}
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-forest-900/30 accent-forest-700"
        />
        <span>{label}</span>
      </label>
      {error?.length ? <p role="alert" className="text-xs text-red-600">{error[0]}</p> : null}
    </div>
  );
}

/** Spam trap for public forms. Real users never see or fill this. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
