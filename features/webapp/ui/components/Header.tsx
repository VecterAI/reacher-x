"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Button } from "@/shared/ui/components/Button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerClose,
} from "@/shared/ui/components/Drawer";
import {
  XIcon,
  DiscordIcon,
  ThreadsIcon,
  InstagramIcon,
  MoreHorizIcon,
  MailIcon,
  HomeIcon,
  SearchActivityIcon,
} from "@/shared/ui/components/icons";
import { NavLink } from "@/features/landing/ui/components/NavLink";
import { SidebarTrigger } from "@/shared/ui/components/Sidebar";

/* ----------------------------------------------------------------------------
 * Header variants (CVA)
 * ----------------------------------------------------------------------------
 * Encapsulate the root styles for <header>. You can add variants for size,
 * color-scheme, etc. if desired. Here we simply do the responsive spacing.
 */
const headerVariants = cva(
  // Base classes
  "fixed top-0 left-0 right-0 z-20 flex items-center justify-between ease-[cubic-bezier(0.25, 1, 0.5, 1)] duration-300 border-b border-border w-full h-12 bg-background",
  {
    variants: {
      // Example variant: size
      size: {
        default: "pr-4 md:pr-2",
        // Could add e.g. sm, lg, etc.
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

// Optional cva for sub-elements if you want them standardized as well:
const desktopNavMenuVariants = cva("items-center gap-2 flex");
const brandLinkVariants = cva(
  "text-[1.75rem] font-medium font-mono w-12 text-center leading-[normal!important]"
);
const navVariants = cva("flex items-center gap-0 md:gap-4");
const drawerMenuVariants = cva("flex flex-col items-start");

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
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="ReacherX Home"
            className={cn(brandLinkVariants())}
          >
            🆁
          </Link>

          <span className="mr-2 inline-block border-l border-r border-border px-2 py-[0.969rem] text-xs font-bold">
            v3 Beta
          </span>

          <SidebarTrigger />

          <Button
            size="xs"
            variant="ghost"
            className="md:hidden"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open mobile navigation menu"
          >
            <SearchActivityIcon
              className="fill-foreground"
              aria-hidden="true"
            />
            History
          </Button>
        </div>

        <nav className={cn(navVariants())} aria-label="Main navigation">
          <menu
            className={cn(desktopNavMenuVariants())}
            aria-label="Desktop navigation menu"
          >
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="xsIcon"
                    variant="outline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="More options"
                  >
                    <MoreHorizIcon
                      className="fill-foreground"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="mailto:support@reacherx.com"
                      className="cursor-pointer"
                    >
                      <MailIcon className="fill-current" aria-hidden="true" />
                      Reach out/feedback
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/home" className="cursor-pointer">
                      <HomeIcon className="fill-current" aria-hidden="true" />
                      Home page
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
            <li>
              <Link href="/auth">
                <Button size="xs" aria-label="More options">
                  Log in
                </Button>
              </Link>
            </li>
          </menu>
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
                      href="/"
                      activeClassName="underline text-primary font-medium"
                      size="lg"
                      className="px-4 py-2 pt-0 font-normal text-muted-foreground"
                    >
                      Home
                    </NavLink>
                  </DrawerClose>
                </li>
                <li>
                  <DrawerClose asChild>
                    <NavLink
                      href="/threads"
                      activeClassName="underline text-primary font-medium"
                      className="px-4 py-2 font-normal text-muted-foreground"
                      size="lg"
                    >
                      Threads
                    </NavLink>
                  </DrawerClose>
                </li>
                <li>
                  <Button
                    className="text-xl font-normal text-muted-foreground"
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
                  <small className="text-sm font-medium text-muted-foreground">
                    Follow on
                  </small>
                  <div className="flex items-center">
                    <Link
                      href="https://x.com/ReacherXfounder"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        aria-label="ReacherX on X (formerly Twitter)"
                        variant={"ghost"}
                        size={"icon"}
                        className="[&_svg]:size-8"
                      >
                        <XIcon className="fill-current" />
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
                    <Link
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
                    </Link>
                  </div>
                </DrawerFooter>
              </footer>
            </aside>
          </DrawerContent>
        </Drawer>
      </Comp>
    );
  }
);

Header.displayName = "Header";
