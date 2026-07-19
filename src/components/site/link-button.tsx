import Link from "next/link";
import type { ComponentProps } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

interface LinkButtonProps
  extends VariantProps<typeof buttonVariants>,
    Pick<ComponentProps<typeof Link>, "href" | "target" | "rel"> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LinkButton({
  href,
  target,
  rel,
  variant,
  size,
  className,
  children,
  onClick,
}: LinkButtonProps) {
  return (
    <Button
      render={<Link href={href} target={target} rel={rel} onClick={onClick} />}
      nativeButton={false}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </Button>
  );
}
