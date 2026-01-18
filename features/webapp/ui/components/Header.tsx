"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

import { cn } from "@/shared/lib/utils";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/shared/ui/components/DropdownMenu";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import {
  AccountBoxIcon,
  AddIcon,
  ArchiveIcon,
  BidLandscapeIcon,
  ChangeCircleIcon,
  ContrastIcon,
  DarkModeIcon,
  FolderCopyIcon,
  FolderIcon,
  FramePersonIcon,
  GroupIcon,
  HomeIcon,
  InsertChartIcon,
  LightModeIcon,
  LogoutIcon,
  MailIcon,
  ManageAccountsIcon,
  NotificationsIcon,
  UpgradeIcon,
} from "@/shared/ui/components/icons";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { SidebarTrigger } from "@/shared/ui/components/Sidebar";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { useAuth as useAppAuth } from "@/shared/hooks/useAuth";

// Hardcoded notification count - will be replaced with real query later
const NOTIFICATION_COUNT = 0;

/* ----------------------------------------------------------------------------
 * Header Variants (CVA)
 * ----------------------------------------------------------------------------
 */
const headerVariants = cva(
  "fixed top-0 left-0 right-0 z-20 flex items-center justify-between ease-[cubic-bezier(0.25,1,0.5,1)] duration-300 border-b border-border w-full h-12 bg-background",
  {
    variants: {
      size: {
        default: "pr-4 md:pr-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const desktopNavMenuVariants = cva("items-center gap-2 flex");
const brandLinkVariants = cva(
  "text-[1.75rem] font-medium font-mono w-12 text-center leading-[normal!important]"
);
const navVariants = cva("flex items-center gap-0 md:gap-4");

/* ----------------------------------------------------------------------------
 * Header Props
 * ----------------------------------------------------------------------------
 */
export interface HeaderProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof headerVariants> {
  asChild?: boolean;
}

/* ----------------------------------------------------------------------------
 * Header Component
 * ----------------------------------------------------------------------------
 */
export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ className, size, asChild = false, ...props }, ref) => {
    const { user, loading } = useAuth();
    const { workspace } = useAppAuth();
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    // Get current user plan
    const plan = useQuery(api.plans.getCurrentPlan, user ? {} : "skip");

    // Get user workspaces
    const userWorkspaces = useQuery(
      api.workspaces.getUserWorkspaces,
      user ? {} : "skip"
    );

    // Allow overriding the rendered element
    const Comp = asChild ? Slot : "header";

    // Derive tier and workspace info
    const tier = plan?.tier ?? "free";
    const isFree = tier === "free";
    const displayName = user?.firstName || user?.email || "User";
    const displayImage = user?.profilePictureUrl;
    const workspaceName = workspace?.name || "Workspace";

    // Use real workspaces from query
    const workspaces = userWorkspaces ?? [];
    const hasMultipleWorkspaces = workspaces.length > 1;
    // TODO: Implement tier-based workspace limits
    const hasRoomForNewWorkspace = true;

    // Helper for avatar fallback
    const getInitials = (name?: string) => {
      if (!name) return "?";
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    };

    // Tier badge label
    const tierLabel =
      tier === "free" ? "Free" : tier === "base" ? "Base" : "Pro";

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

    // Loading state
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
            <span className="border-border mr-2 inline-block border-r border-l px-2 py-[0.969rem] font-mono text-xs font-bold">
              v4.0 beta
            </span>
            <SidebarTrigger />
          </div>
          <nav className={cn(navVariants())} aria-label="Main navigation">
            <menu
              className={cn(desktopNavMenuVariants())}
              aria-label="Navigation menu"
            >
              <li>
                <Skeleton className="h-6 w-6 rounded-md" aria-hidden="true" />
              </li>
              <li>
                <Skeleton className="h-8 w-8 rounded-full" aria-hidden="true" />
              </li>
            </menu>
          </nav>
        </Comp>
      );
    }

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
          <span className="border-border mr-2 inline-block border-r border-l px-2 py-[0.969rem] font-mono text-xs font-bold">
            v4.0 beta
          </span>
          <SidebarTrigger />
        </div>

        <nav className={cn(navVariants())} aria-label="Main navigation">
          <menu
            className={cn(desktopNavMenuVariants())}
            aria-label="Navigation menu"
          >
            {/* Notification button */}
            <li className={NOTIFICATION_COUNT > 0 ? "mr-4" : undefined}>
              <Button
                variant="ghost"
                size="xsIcon"
                asChild
                aria-label="Notifications"
                className="relative"
              >
                <Link href="/notifications">
                  <NotificationsIcon
                    className="fill-current"
                    aria-hidden="true"
                  />
                  {NOTIFICATION_COUNT > 0 && (
                    <Badge
                      variant="secondary"
                      className="border-background absolute -top-2 left-2.5 flex h-5 min-w-5 items-center justify-center border px-1 text-[10px]"
                    >
                      <AnimatedNumber
                        value={NOTIFICATION_COUNT}
                        suffix={NOTIFICATION_COUNT >= 100 ? "+" : undefined}
                        animateOnMount
                      />
                    </Badge>
                  )}
                </Link>
              </Button>
            </li>
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="User menu">
                    <Avatar className="size-8">
                      <AvatarImage src={displayImage || ""} alt={displayName} />
                      <AvatarFallback>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* User name + tier badge */}
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span className="truncate">{displayName}</span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {tierLabel}
                    </Badge>
                  </DropdownMenuLabel>

                  {/* Upgrade (free tier only) */}
                  {isFree && (
                    <>
                      <DropdownMenuItem asChild>
                        <a
                          href={process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <UpgradeIcon
                            className="fill-current"
                            aria-hidden="true"
                          />
                          Upgrade plan
                        </a>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {/* Navigation: Prospects, Contacts, Archive */}
                  <DropdownMenuItem asChild>
                    <Link href="/">
                      <FramePersonIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      Prospects
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/contacts">
                      <AccountBoxIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      Contacts
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/archive">
                      <ArchiveIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      Archive
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Analytics */}
                  <DropdownMenuItem asChild>
                    <Link href="/analytics">
                      <BidLandscapeIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      Analytics
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Connected accounts */}
                  <DropdownMenuItem asChild>
                    <Link href="/settings/connected-accounts">
                      <ManageAccountsIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      Connected accounts
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Current workspace */}
                  <DropdownMenuItem asChild>
                    <Link href="/workspace">
                      <FolderIcon className="fill-current" aria-hidden="true" />
                      <span className="truncate">{workspaceName}</span>
                    </Link>
                  </DropdownMenuItem>

                  {/* Workspaces submenu (paid with multiple) OR New workspace (paid with single) */}
                  {!isFree && hasMultipleWorkspaces ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderCopyIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        Workspaces
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup
                            value={workspace?._id ?? "default"}
                            onValueChange={(id) => {
                              // TODO: Implement workspace switching
                              console.info("Switch to workspace:", id);
                            }}
                          >
                            {workspaces.map((ws) => (
                              <DropdownMenuRadioItem
                                key={ws._id}
                                value={ws._id}
                              >
                                {ws.name}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                          {hasRoomForNewWorkspace && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href="/workspace/new">
                                  <AddIcon
                                    className="fill-current"
                                    aria-hidden="true"
                                  />
                                  New workspace
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  ) : !isFree ? (
                    <DropdownMenuItem asChild>
                      <Link href="/workspace/new">
                        <AddIcon className="fill-current" aria-hidden="true" />
                        New workspace
                      </Link>
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuSeparator />

                  {/* Theme */}
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <ContrastIcon className="fill-current" aria-hidden="true" />
                    Theme
                    <span className="ml-auto">{themeToggle}</span>
                  </DropdownMenuItem>

                  {/* Reach out/feedback */}
                  <DropdownMenuItem asChild>
                    <a href="mailto:support@reacherx.com">
                      <MailIcon className="fill-current" aria-hidden="true" />
                      Reach out/feedback
                    </a>
                  </DropdownMenuItem>

                  {/* Home page */}
                  <DropdownMenuItem asChild>
                    <Link href="/home">
                      <HomeIcon className="fill-current" aria-hidden="true" />
                      Home page
                    </Link>
                  </DropdownMenuItem>

                  {/* Log out */}
                  <DropdownMenuItem onClick={() => router.push("/logout")}>
                    <LogoutIcon className="fill-current" aria-hidden="true" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </menu>
        </nav>
      </Comp>
    );
  }
);

Header.displayName = "Header";
