"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitEnquiry } from "@/app/contact/actions";
import { enquirySchema, type EnquiryInput } from "@/lib/enquiry-schema";

const interests = [
  "Day Escape",
  "Farmhouse Overnight",
  "Weekend Retreat",
  "Corporate Offsite",
  "Something else",
];

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      groupSize: "",
      preferredDate: "",
      interest: "",
      message: "",
    },
  });

  async function onSubmit(data: EnquiryInput) {
    setSubmitError(null);
    const result = await submitEnquiry(data);
    if (result.success) {
      setSubmitted(true);
      reset();
    } else {
      setSubmitError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-forest-50 p-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-forest-600" />
        <h3 className="mt-4 font-display text-2xl text-forest-950">
          Thank you — we&apos;ve received your enquiry.
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/60">
          Our team will get back to you within 24 hours to confirm
          availability and next steps.
        </p>
        <Button
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => setSubmitted(false)}
        >
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" placeholder="Your name" {...register("name")} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" placeholder="+91 98765 43210" {...register("phone")} />
          {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" type="email" placeholder="you@email.com" {...register("email")} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="groupSize">Group Size</Label>
          <Input id="groupSize" placeholder="e.g. 2 adults, 1 child" {...register("groupSize")} />
          {errors.groupSize ? (
            <p className="text-xs text-destructive">{errors.groupSize.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preferredDate">Preferred Date</Label>
          <Input id="preferredDate" type="date" {...register("preferredDate")} />
          {errors.preferredDate ? (
            <p className="text-xs text-destructive">{errors.preferredDate.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="interest">I&apos;m Enquiring About</Label>
        <Controller
          name="interest"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="interest" className="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {interests.map((interest) => (
                  <SelectItem key={interest} value={interest}>
                    {interest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.interest ? (
          <p className="text-xs text-destructive">{errors.interest.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message (Optional)</Label>
        <Textarea
          id="message"
          rows={4}
          placeholder="Tell us anything else that would help us plan your visit."
          {...register("message")}
        />
      </div>

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="rounded-full bg-forest-800 text-cream hover:bg-forest-700"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending
          </>
        ) : (
          "Send Enquiry"
        )}
      </Button>
    </form>
  );
}
