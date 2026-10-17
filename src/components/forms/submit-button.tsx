"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "outline" | "danger";
  disabled?: boolean;
}

const variants = {
  primary: "bg-forest-800 text-cream hover:bg-forest-700",
  outline: "border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function SubmitButton({ children, pendingLabel, className, variant = "primary", disabled }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {pendingLabel ?? "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
