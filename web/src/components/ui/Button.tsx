import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"a"> & {
  variant?: "primary" | "ghost";
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <a
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[15px] font-medium transition-colors",
        variant === "primary" &&
          "bg-brand text-white hover:bg-brand-hover",
        variant === "ghost" &&
          "bg-white/[0.02] text-text-primary border border-border-default hover:bg-white/[0.05]",
        className,
      )}
    >
      {children}
    </a>
  );
}
