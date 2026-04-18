import * as React from "react";

import { Button, type ButtonProps } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";

interface IconButtonWithIndicatorProps extends ButtonProps {
  showIndicator?: boolean;
  indicatorClassName?: string;
}

export const IconButtonWithIndicator = React.forwardRef<
  HTMLButtonElement,
  IconButtonWithIndicatorProps
>(
  (
    {
      className,
      children,
      showIndicator = false,
      indicatorClassName,
      variant = "outline",
      size = "xsIcon",
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        className={cn("relative", className)}
        variant={variant}
        size={size}
        {...props}
      >
        {children}
        {showIndicator ? (
          <span
            aria-hidden="true"
            className={cn(
              "bg-foreground ring-background absolute top-0 right-0 h-2 w-2 translate-x-1/4 -translate-y-1/4 rounded-full ring-2",
              indicatorClassName
            )}
          />
        ) : null}
      </Button>
    );
  }
);

IconButtonWithIndicator.displayName = "IconButtonWithIndicator";
