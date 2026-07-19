import { Quote } from "lucide-react";
import type { Testimonial } from "@/lib/content";

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-3xl bg-forest-50 p-8 ring-1 ring-forest-900/6">
      <Quote className="h-7 w-7 text-forest-400" />
      <blockquote className="mt-5 flex-1 text-lg leading-relaxed text-forest-950/85">
        “{testimonial.quote}”
      </blockquote>
      <figcaption className="mt-6 border-t border-forest-900/10 pt-4">
        <p className="font-medium text-forest-950">{testimonial.name}</p>
        <p className="text-sm text-forest-950/55">{testimonial.role}</p>
      </figcaption>
    </figure>
  );
}
