"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/components/Drawer";

/* ----------------------------------------------------------------------------
 * Mode Toggle
 * ----------------------------------------------------------------------------
 * A simple single-click dark/light toggle. If you prefer multiple options
 * (light, dark, system), you can replace this with a shadcn/ui dropdown.
 */
function ModeToggle() {
  const { theme, setTheme } = useTheme();

  const handleToggle = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <Button variant="outline" size="icon" onClick={handleToggle}>
      {/* Sun icon (light mode) */}
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      {/* Moon icon (dark mode) */}
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

/* ----------------------------------------------------------------------------
 * Header variants (CVA)
 * ----------------------------------------------------------------------------
 * Encapsulate the root styles for <header>. You can add variants for size,
 * color-scheme, etc. if desired. Here we simply do the responsive spacing.
 */
const headerVariants = cva(
  // Base classes
  "flex items-center justify-between",
  {
    variants: {
      // Example variant: size
      size: {
        default: "px-4 py-2 md:px-[112px] md:py-[24px]",
        // Could add e.g. sm, lg, etc.
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

// Optional cva for sub-elements if you want them standardized as well:
const navVariants = cva("hidden items-center gap-4 md:flex");
const brandLinkVariants = cva("text-xl font-bold");
const rightSideVariants = cva("flex items-center gap-4");
const drawerMenuVariants = cva("flex flex-col gap-4 p-4");

/* ----------------------------------------------------------------------------
 * Header Props
 * ----------------------------------------------------------------------------
 */
export interface HeaderProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof headerVariants> {
  /** If true, wraps the content in a Radix <Slot> instead of <header> */
  asChild?: boolean;
}

/* ----------------------------------------------------------------------------
 * Header Component
 * ----------------------------------------------------------------------------
 */
export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ className, size, asChild = false, ...props }, ref) => {
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

    // Allow overriding the rendered element (similar to Button)
    const Comp = asChild ? Slot : "header";

    return (
      <Comp
        className={cn(headerVariants({ size }), className)}
        ref={ref}
        {...props}
      >
        {/* Brand link / title */}
        <Link
          href="/"
          aria-label="ReacherX Home"
          className={cn(brandLinkVariants())}
        >
          🆁 ReacherX
        </Link>

        {/* Right side: nav links (desktop) + theme toggle + mobile menu button */}
        <div className={cn(rightSideVariants())}>
          {/* Desktop nav (3 link buttons), hidden on mobile */}
          <nav className={cn(navVariants())}>
            <Button variant="link">Vision</Button>
            <Button variant="link">Threads</Button>
            <Button
              variant="link"
              onClick={() => {
                window.location.href = "mailto:support@reacherx.com";
              }}
            >
              Contact
            </Button>
          </nav>

          {/* Single theme toggle button (always visible) */}
          <ModeToggle />

          {/* "Menu" button (mobile only) */}
          <Button
            variant="ghost"
            className="md:hidden"
            onClick={() => setIsDrawerOpen(true)}
          >
            Menu
          </Button>
        </div>

        {/* Drawer for mobile menu */}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent>
            <DrawerHeader className="flex items-center justify-between p-4">
              <DrawerTitle>Menu</DrawerTitle>
              <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>
                Close
              </Button>
            </DrawerHeader>

            <div className={cn(drawerMenuVariants())}>
              <Button variant="link">Vision</Button>
              <Button variant="link">Threads</Button>
              <Button
                variant="link"
                onClick={() => {
                  window.location.href = "mailto:support@reacherx.com";
                }}
              >
                Contact
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </Comp>
    );
  }
);

Header.displayName = "Header";
