import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "font-geist inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-taxi text-[#052e16] hover:bg-[#9cf6bc] active:bg-[#34d399]",
        quiet: "border border-line bg-night-2 text-ink hover:bg-night-3 active:bg-night-4",
        ghost: "text-ink-dim hover:text-ink hover:bg-night-3",
        up: "bg-up text-[#052e16] hover:bg-[#9cf6bc]",
        down: "bg-down text-night hover:bg-[#ff7d88]",
      },
      size: {
        md: "h-10 px-4",
        lg: "h-11 px-5 text-[15px]",
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
