"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch, Controller } from "react-hook-form";
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
import { submitBooking } from "@/app/book/actions";
import {
  bookingSchema,
  experienceTypes,
  stayTypes,
  type BookingInput,
} from "@/lib/booking-schema";

const packageLabels: Record<string, string> = {
  "day-escape": "The Day Escape",
  "farmhouse-overnight": "Farmhouse Overnight",
  "weekend-retreat": "The Weekend Retreat",
};

export function BookingForm() {
  const searchParams = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      preferredDate: "",
      adults: "2",
      children: "",
      experienceType: "",
      stayType: "",
      projectType: "",
      projectLocation: "",
      projectSize: "",
      message: "",
    },
  });

  const experienceType = useWatch({ control, name: "experienceType" });

  // Prefill from query params set by CTAs elsewhere on the site, e.g.
  // /book?experience=nature-stay&stay=cottage&package=farmhouse-overnight
  useEffect(() => {
    const experience = searchParams.get("experience");
    const stay = searchParams.get("stay");
    const pkg = searchParams.get("package");

    if (experience && experienceTypes.some((e) => e.value === experience)) {
      setValue("experienceType", experience);
    }
    if (stay && stayTypes.some((s) => s.value === stay)) {
      setValue("stayType", stay);
    }
    if (pkg && packageLabels[pkg]) {
      setValue("message", `Interested in: ${packageLabels[pkg]}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onSubmit(data: BookingInput) {
    setSubmitError(null);
    const result = await submitBooking(data);
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
          Thank you. Your request is with our team.
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/60">
          Someone from Hasiru Nidhi will contact you shortly to confirm
          availability and next steps.
        </p>
        <Button
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => setSubmitted(false)}
        >
          Plan another visit
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <div>
        <p className="text-eyebrow mb-4">Personal Details</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" placeholder="Your name" {...register("fullName")} />
            {errors.fullName ? (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" placeholder="+91 98765 43210" {...register("phone")} />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" type="email" placeholder="you@email.com" {...register("email")} />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-eyebrow mb-4">Your Visit</p>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="preferredDate">Preferred Date</Label>
            <Input id="preferredDate" type="date" {...register("preferredDate")} />
            {errors.preferredDate ? (
              <p className="text-xs text-destructive">{errors.preferredDate.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adults">Adults</Label>
            <Input id="adults" type="number" min={1} {...register("adults")} />
            {errors.adults ? (
              <p className="text-xs text-destructive">{errors.adults.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="children">Children</Label>
            <Input id="children" type="number" min={0} placeholder="0" {...register("children")} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-eyebrow mb-4">Experience</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="experienceType">What would you like to experience?</Label>
          <Controller
            name="experienceType"
            control={control}
            render={({ field }) => (
              <Select
                items={experienceTypes as unknown as { value: string; label: string }[]}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="experienceType" className="w-full">
                  <SelectValue placeholder="Select an experience" />
                </SelectTrigger>
                <SelectContent>
                  {experienceTypes.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.experienceType ? (
            <p className="text-xs text-destructive">{errors.experienceType.message}</p>
          ) : null}
        </div>

        {experienceType === "nature-stay" ? (
          <div className="mt-6 flex flex-col gap-2">
            <Label htmlFor="stayType">Which stay are you interested in?</Label>
            <Controller
              name="stayType"
              control={control}
              render={({ field }) => (
                <Select
                  items={stayTypes as unknown as { value: string; label: string }[]}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="stayType" className="w-full">
                    <SelectValue placeholder="Select a stay option" />
                  </SelectTrigger>
                  <SelectContent>
                    {stayTypes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        ) : null}

        {experienceType === "landscaping" ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="projectType">Project Type</Label>
              <Input
                id="projectType"
                placeholder="e.g. Garden design, native planting"
                {...register("projectType")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="projectLocation">Project Location</Label>
              <Input id="projectLocation" placeholder="City / area" {...register("projectLocation")} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="projectSize">Approximate Project Size</Label>
              <Input
                id="projectSize"
                placeholder="e.g. Small courtyard, 2-acre farmhouse plot"
                {...register("projectSize")}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Special Requests / Questions</Label>
        <Textarea
          id="message"
          rows={4}
          placeholder="Tell us anything that would help us plan your visit."
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
          "Request Availability"
        )}
      </Button>
    </form>
  );
}
