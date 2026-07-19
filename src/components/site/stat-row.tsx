import { StaggerGroup, StaggerItem } from "@/components/site/reveal";
import { stats } from "@/lib/content";
import { cn } from "@/lib/utils";

export function StatRow({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-8 sm:grid-cols-4">
      {stats.map((stat) => (
        <StaggerItem key={stat.label}>
          <p
            className={cn(
              "font-display text-4xl sm:text-5xl",
              tone === "dark" ? "text-forest-950" : "text-cream"
            )}
          >
            {stat.value}
          </p>
          <p
            className={cn(
              "mt-2 text-sm leading-snug",
              tone === "dark" ? "text-ink/60" : "text-cream/60"
            )}
          >
            {stat.label}
          </p>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
