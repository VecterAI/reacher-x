import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils/utils";

const inputVariants = cva(
  "flex w-full rounded-md border border-input bg-background text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  {
    variants: {
      size: {
        default: "h-10 px-3 py-2",
        xs: "h-6 px-2 py-1 text-xs md:text-xs",
        sm: "h-9 px-3 py-2",
        lg: "h-11 px-4 py-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
