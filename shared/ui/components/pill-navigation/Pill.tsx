import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

// Shared appearance for route links and Radix selection controls.
export const pillClassName =
  "inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full border-0 px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:bg-muted data-[state=on]:bg-muted data-[state=on]:text-foreground";
export const pillListClassName = "flex w-max items-center justify-start gap-1";
export function PillLink({
  className,
  asChild = false,
  ...props
}: ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "a";
  return <Comp className={cn(pillClassName, className)} {...props} />;
}
export function PillNavigation({
  className,
  children,
  ...props
}: ComponentProps<"nav">) {
  return (
    <nav
      className={cn(
        "scroll-fade-x max-w-full scrollbar-none overflow-x-auto",
        className
      )}
      {...props}
    >
      <div className={pillListClassName}>{children}</div>
    </nav>
  );
}
