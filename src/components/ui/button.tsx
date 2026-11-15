import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[2px] font-semibold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-taxi text-night hover:bg-[#ffe97a] active:bg-[#e6c400]",
        quiet: "border border-line bg-night-2 text-ink hover:bg-night-3 active:bg-night-4",
        ghost: "text-ink-dim hover:text-ink hover:bg-night-3",
        up: "bg-up text-night hover:bg-[#d6ff63]",
        down: "bg-down text-night hover:bg-[#ff6a50]",
      },
      size: {
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
