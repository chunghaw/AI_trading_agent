import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
// import { cn } from "../../lib/utils";

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] hover:bg-[var(--accent-600)] text-black h-10 px-4 shadow-sm hover:shadow-md",
        destructive:
          "bg-[var(--danger)] text-white hover:opacity-90 h-10 px-4 shadow-sm",
        outline:
          "border border-white/10 hover:bg-white/5 text-[var(--text)] h-10 px-4 backdrop-blur-sm",
        secondary:
          "bg-white/5 text-[var(--text)] hover:bg-white/10 h-10 px-4 border border-white/10 backdrop-blur-sm",
        ghost:
          "hover:bg-white/5 border border-transparent hover:border-white/10 text-[var(--text)] h-10 px-4",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants }; 