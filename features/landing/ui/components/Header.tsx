"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { buttonVariants } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerClose,
} from "@/shared/ui/components/Drawer";
import {
  LightModeIcon,
  DarkModeIcon,
  TwitterIcon,
  DiscordIcon,
  ThreadsIcon,
  ArrowOutwardIcon,
  LinkedinIcon,
  BlueskyIcon,
} from "@/shared/ui/components/icons";
import { NavLink } from "./NavLink";

/* ----------------------------------------------------------------------------
 * Mode Toggle
 * ----------------------------------------------------------------------------
 * A simple single-click dark/light toggle. If you prefer multiple options
 * (light, dark, system), you can replace this with a shadcn/ui dropdown.
 */
function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Handle hydration mismatch by mounting after first render
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Theme toggle button loading"
      >
        <Skeleton className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={
        resolvedTheme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
    >
      {resolvedTheme === "dark" ? (
        <LightModeIcon className="fill-current" />
      ) : (
        <DarkModeIcon className="fill-current" />
      )}
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
  "flex items-center justify-between ease-[cubic-bezier(0.25, 1, 0.5, 1)] duration-300 ",
  {
    variants: {
      // Example variant: size
      size: {
        default: "px-0 py-2 md:py-6",
        // Could add e.g. sm, lg, etc.
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

// Optional cva for sub-elements if you want them standardized as well:
const desktopNavMenuVariants = cva("hidden items-center gap-4 md:flex");
const brandLinkVariants = cva("text-base font-medium font-mono");
const navVariants = cva("flex items-center gap-0 md:gap-4");
const drawerMenuVariants = cva("flex flex-col items-start");

/* ----------------------------------------------------------------------------
 * Header Props
 * ----------------------------------------------------------------------------
 */
export interface HeaderProps
  extends
    React.HTMLAttributes<HTMLElement>,
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
        <div className="mx-auto flex w-full max-w-[1288px] items-center justify-between px-4">
          <Link
            href="/"
            aria-label="ReacherX Home"
            className={cn(brandLinkVariants())}
          >
            🆁 ReacherX
          </Link>

          <nav className={cn(navVariants())} aria-label="Main navigation">
            <ThemeToggle />

            <menu
              className={cn(desktopNavMenuVariants())}
              aria-label="Desktop navigation menu"
            >
              <li>
                <NavLink href="/home/threads" activeClassName="underline">
                  Threads
                </NavLink>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => {
                    window.location.href = "mailto:support@reacherx.com";
                  }}
                >
                  Contact
                </Button>
              </li>
            </menu>
            <Link href="/" className={cn(buttonVariants({ variant: "link" }))}>
              App
              <ArrowOutwardIcon className="size-6 fill-current" />
            </Link>

            <Button
              variant="ghost"
              className="md:hidden"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open mobile navigation menu"
            >
              Menu
            </Button>
          </nav>

          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerContent>
              <aside aria-label="Mobile Navigation Menu">
                <header>
                  <DrawerHeader className="flex items-center justify-between p-4">
                    <DrawerTitle>Menu.</DrawerTitle>
                    <Button
                      variant="ghost"
                      onClick={() => setIsDrawerOpen(false)}
                      aria-label="Close mobile navigation menu"
                    >
                      Close
                    </Button>
                  </DrawerHeader>
                </header>

                <menu
                  className={cn(drawerMenuVariants())}
                  aria-label="Mobile menu items"
                >
                  <li>
                    <DrawerClose asChild>
                      <NavLink
                        href="/home"
                        activeClassName="underline text-primary font-medium"
                        exact
                        size="lg"
                        className="text-muted-foreground px-4 py-2 pt-0 font-normal"
                      >
                        Home
                      </NavLink>
                    </DrawerClose>
                  </li>
                  <li>
                    <DrawerClose asChild>
                      <NavLink
                        href="/home/threads"
                        activeClassName="underline text-primary font-medium"
                        className="text-muted-foreground px-4 py-2 font-normal"
                        size="lg"
                      >
                        Threads
                      </NavLink>
                    </DrawerClose>
                  </li>
                  <li>
                    <Button
                      className="text-muted-foreground text-xl font-normal"
                      variant="link"
                      onClick={() => {
                        window.location.href = "mailto:support@reacherx.com";
                      }}
                    >
                      Contact
                    </Button>
                  </li>
                </menu>
                <footer>
                  <DrawerFooter>
                    <small className="text-muted-foreground text-sm font-medium">
                      Follow on
                    </small>
                    <div className="flex items-center">
                      <Link
                        href="https://x.com/ReacherXfounder"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          aria-label="ReacherX on X/Twitter"
                          variant={"ghost"}
                          size={"icon"}
                          className="[&_svg]:size-8"
                        >
                          <TwitterIcon />
                        </Button>
                      </Link>
                      <Link
                        href="https://discord.gg/76dF9NPH"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          aria-label="ReacherX on Discord"
                          variant={"ghost"}
                          size={"icon"}
                          className="[&_svg]:size-8"
                        >
                          <DiscordIcon className="fill-current" />
                        </Button>
                      </Link>
                      <Link
                        href="https://www.linkedin.com/in/noobships"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          aria-label="ReacherX on LinkedIn"
                          variant={"ghost"}
                          size={"icon"}
                          className="[&_svg]:size-8"
                        >
                          <LinkedinIcon className="fill-current" />
                        </Button>
                      </Link>
                      <Link
                        href="https://bsky.app/profile/reacherxfounder.bsky.social"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          aria-label="ReacherX on Bluesky"
                          variant={"ghost"}
                          size={"icon"}
                          className="[&_svg]:size-8"
                        >
                          <BlueskyIcon className="stroke-current" />
                        </Button>
                      </Link>
                      <Link
                        href="https://threads.net/@reacherxfounder"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          aria-label="ReacherX on Threads"
                          variant={"ghost"}
                          size={"icon"}
                          className="[&_svg]:size-8"
                        >
                          <ThreadsIcon className="fill-current" />
                        </Button>
                      </Link>
                      {/* <Link
                        href="https://instagram.com/reacherxfounder/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          aria-label="ReacherX on Instagram"
                          variant={"ghost"}
                          size={"icon"}
                          className="[&_svg]:size-8"
                        >
                          <InstagramIcon className="fill-current" />
                        </Button>
                      </Link> */}
                    </div>
                  </DrawerFooter>
                </footer>
              </aside>
            </DrawerContent>
          </Drawer>
        </div>
      </Comp>
    );
  }
);

Header.displayName = "Header";
