import { EmptyState } from "@/components/app/ui";
import type { VendorContext } from "@/lib/vendor";
import { isCapabilityActive } from "@/lib/vendor";

/** Shown instead of a selling page when the vendor is not (yet) approved to sell products. */
export function ProductsGate({ ctx }: { ctx: VendorContext }) {
  if (isCapabilityActive(ctx, "products")) return null;
  const cap = ctx.capabilities.find((c) => c.capability === "products");
  return (
    <EmptyState
      title="Selling products needs approval"
      description={!ctx.vendor ? "Apply as a vendor first." : cap ? `Your request to sell products is ${cap.status}. Our team approves each part of the marketplace separately.` : "Request the products capability from your vendor overview. Our team approves each part of the marketplace separately."}
      action={{ href: "/vendor", label: "Go to your vendor overview" }}
    />
  );
}

/** Shown instead of a services page when the vendor is not (yet) approved to provide services. */
export function ServicesGate({ ctx }: { ctx: VendorContext }) {
  if (isCapabilityActive(ctx, "services")) return null;
  const cap = ctx.capabilities.find((c) => c.capability === "services");
  return (
    <EmptyState
      title="Providing services needs approval"
      description={!ctx.vendor ? "Apply as a vendor first." : cap ? `Your request to provide services is ${cap.status}. Our team approves each part of the marketplace separately.` : "Request the services capability from your vendor overview. Our team approves each part of the marketplace separately."}
      action={{ href: "/vendor", label: "Go to your vendor overview" }}
    />
  );
}
