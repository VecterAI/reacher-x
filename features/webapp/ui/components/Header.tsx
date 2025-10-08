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
  ChangeCircleIcon,
  ContrastIcon,
  DarkModeIcon,
  DataUsageIcon,
  FilledFolderIcon,
  HomeIcon,
  LightModeIcon,
  LogoutIcon,
  MailIcon,
  ManageAccountsIcon,
  MoreHorizIcon,
} from "@/shared/ui/components/icons";
import { SidebarTrigger } from "@/shared/ui/components/Sidebar";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/shared/ui/components/Drawer";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { clearAllLocalAppData } from "@/shared/lib/utils/localStorage";

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
const drawerMenuVariants = cva("flex flex-col gap-2");

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
    const { user, loading } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();
    const { theme, setTheme } = useTheme();

    // Allow overriding the rendered element (similar to Button)
    const Comp = asChild ? Slot : "header";

    // Helper for avatar fallback
    const getInitials = (name?: string) => {
      if (!name) return "?";
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    };

    const displayImage = user?.profilePictureUrl;
    const displayName = user?.firstName || user?.email || "User";

    // Show loading state while authentication is being determined
    if (loading) {
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

            <span className="mr-2 inline-block border-l border-r border-border px-2 py-[0.969rem] font-mono text-xs font-bold">
              v3 Beta
            </span>

            <SidebarTrigger />
          </div>

          <nav className={cn(navVariants())} aria-label="Main navigation">
            <menu
              className={cn(desktopNavMenuVariants())}
              aria-label="Desktop navigation menu"
            >
              <li>
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              </li>
            </menu>
          </nav>
        </Comp>
      );
    }

    // Theme toggle group
    const themeToggle = (
      <ToggleGroup
        type="single"
        value={theme === undefined ? "system" : theme}
        onValueChange={(val) => val && setTheme(val)}
      >
        <ToggleGroupItem value="system" size="xsIcon">
          <ChangeCircleIcon className="fill-current" aria-hidden="true" />
        </ToggleGroupItem>
        <ToggleGroupItem value="light" size="xsIcon">
          <LightModeIcon className="fill-current" aria-hidden="true" />
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" size="xsIcon">
          <DarkModeIcon className="fill-current" aria-hidden="true" />
        </ToggleGroupItem>
      </ToggleGroup>
    );

    // Unauthenticated menu options
    const unauthMenu = (
      <>
        <DropdownMenuLabel>Menu</DropdownMenuLabel>
        {/* <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/replies">
            <span className="flex items-center gap-2">
              <QuickPhrasesIcon className="fill-current" aria-hidden="true" />
              Replies
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/customers">
            <span className="flex items-center gap-2">
              <GroupIcon className="fill-current" aria-hidden="true" />
              Customers
            </span>
          </Link>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspace">
            <span className="flex items-center gap-2">
              <FilledFolderIcon className="fill-current" aria-hidden="true" />
              Workspace
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/linked-accounts">
            <span className="flex items-center gap-2">
              <ManageAccountsIcon className="fill-current" aria-hidden="true" />
              Linked accounts
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="mailto:support@reacherx.com">
            <span className="flex items-center gap-2">
              <MailIcon className="fill-current" aria-hidden="true" />
              Reach out/feedback
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ContrastIcon className="fill-current" aria-hidden="true" />
          Theme{themeToggle}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/home">
            <span className="flex items-center gap-2">
              <HomeIcon className="fill-current" aria-hidden="true" />
              Home page
            </span>
          </Link>
        </DropdownMenuItem>
      </>
    );

    // Authenticated menu options
    const authMenu = (
      <>
        <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <DataUsageIcon className="fill-current" aria-hidden="true" />
          Post limit
        </DropdownMenuItem>
        {/* <DropdownMenuItem asChild>
          <Link href="/replies">
            <span className="flex items-center gap-2">
              <QuickPhrasesIcon className="fill-current" aria-hidden="true" />
              Replies
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/customers">
            <span className="flex items-center gap-2">
              <GroupIcon className="fill-current" aria-hidden="true" />
              Customers
            </span>
          </Link>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspace">
            <span className="flex items-center gap-2">
              <FilledFolderIcon className="fill-current" aria-hidden="true" />
              Workspace
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/linked-accounts">
            <span className="flex items-center gap-2">
              <ManageAccountsIcon className="fill-current" aria-hidden="true" />
              Linked accounts
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="mailto:support@reacherx.com">
            <span className="flex items-center gap-2">
              <MailIcon className="fill-current" aria-hidden="true" />
              Reach out/feedback
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ContrastIcon className="fill-current" aria-hidden="true" />
          Theme{themeToggle}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/home">
            <span className="flex items-center gap-2">
              <HomeIcon className="fill-current" aria-hidden="true" />
              Home page
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            try {
              clearAllLocalAppData();
            } catch {}
            router.push("/logout");
          }}
        >
          <LogoutIcon className="fill-current" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </>
    );

    return (
      <>
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

            <span className="mr-2 inline-block border-l border-r border-border px-2 py-[0.969rem] font-mono text-xs font-bold">
              v3 Beta
            </span>

            <SidebarTrigger />
          </div>

          <nav className={cn(navVariants())} aria-label="Main navigation">
            <menu
              className={cn(desktopNavMenuVariants())}
              aria-label="Desktop navigation menu"
            >
              {!user ? (
                <>
                  {/* Three-dot menu button */}
                  {!isMobile ? (
                    <li>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="xsIcon"
                            variant="outline"
                            aria-label="More options"
                          >
                            <MoreHorizIcon
                              className="fill-foreground"
                              aria-hidden="true"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {unauthMenu}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ) : (
                    <li>
                      <Button
                        size="xsIcon"
                        variant="outline"
                        aria-label="More options"
                        onClick={() => setIsDrawerOpen(true)}
                      >
                        <MoreHorizIcon
                          className="fill-foreground"
                          aria-hidden="true"
                        />
                      </Button>
                    </li>
                  )}
                  {/* Login button */}
                  <li>
                    <Link href="/login">
                      <Button size="xs" aria-label="Sign in">
                        Sign in
                      </Button>
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  {/* Avatar button */}
                  {!isMobile ? (
                    <li>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="User menu"
                          >
                            <Avatar className="size-8">
                              <AvatarImage
                                src={displayImage || ""}
                                alt={displayName}
                              />
                              <AvatarFallback>
                                {getInitials(displayName)}
                              </AvatarFallback>
                            </Avatar>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {authMenu}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ) : (
                    <li>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="User menu"
                        onClick={() => setIsDrawerOpen(true)}
                      >
                        <Avatar className="size-8">
                          <AvatarImage
                            src={displayImage || ""}
                            alt={displayName}
                          />
                          <AvatarFallback>
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </li>
                  )}
                </>
              )}
            </menu>
          </nav>

          {/* Drawer for mobile menu (unauthenticated or authenticated) */}
          {isMobile && (
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerContent>
                <aside aria-label="Mobile Menu">
                  <header>
                    <DrawerHeader className="flex items-center justify-between p-4">
                      <DrawerTitle>{!user ? "Menu" : displayName}</DrawerTitle>
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
                    {!user ? (
                      <>
                        {/* <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/replies">
                                <span className="flex items-center gap-2">
                                  <QuickPhrasesIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Replies
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li> */}
                        {/* <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/customers">
                                <span className="flex items-center gap-2">
                                  <GroupIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Customers
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li> */}
                        <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/workspace">
                                <span className="flex items-center gap-2">
                                  <FilledFolderIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Workspace
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li>
                        <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/settings/linked-accounts">
                                <span className="flex items-center gap-2">
                                  <ManageAccountsIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Linked accounts
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li>
                        <li>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                          >
                            <a href="mailto:support@reacherx.com">
                              <MailIcon
                                className="fill-current"
                                aria-hidden="true"
                              />
                              Reach out/feedback
                            </a>
                          </Button>
                        </li>
                        <li className="py-2">{themeToggle}</li>
                        <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/home">
                                <span className="flex items-center gap-2">
                                  <HomeIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Home page
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                          >
                            <DataUsageIcon
                              className="fill-current"
                              aria-hidden="true"
                            />
                            Post limit
                          </Button>
                        </li>
                        {/* <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/replies">
                                <span className="flex items-center gap-2">
                                  <QuickPhrasesIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Replies
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li> */}
                        {/* <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/customers">
                                <span className="flex items-center gap-2">
                                  <GroupIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Customers
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li> */}
                        <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/workspace">
                                <span className="flex items-center gap-2">
                                  <FilledFolderIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Workspace
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li>
                        <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/settings/linked-accounts">
                                <span className="flex items-center gap-2">
                                  <ManageAccountsIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Linked accounts
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li>
                        <li>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                          >
                            <a href="mailto:support@reacherx.com">
                              <MailIcon
                                className="fill-current"
                                aria-hidden="true"
                              />
                              Reach out/feedback
                            </a>
                          </Button>
                        </li>
                        <li className="py-2">{themeToggle}</li>
                        <li>
                          <DrawerClose asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              asChild
                            >
                              <Link href="/home">
                                <span className="flex items-center gap-2">
                                  <HomeIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  Home page
                                </span>
                              </Link>
                            </Button>
                          </DrawerClose>
                        </li>
                        <li>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              try {
                                clearAllLocalAppData();
                              } catch {}
                              router.push("/logout");
                              setIsDrawerOpen(false);
                            }}
                          >
                            <LogoutIcon
                              className="fill-current"
                              aria-hidden="true"
                            />
                            Sign out
                          </Button>
                        </li>
                      </>
                    )}
                  </menu>
                </aside>
              </DrawerContent>
            </Drawer>
          )}
        </Comp>
      </>
    );
  }
);

Header.displayName = "Header";
