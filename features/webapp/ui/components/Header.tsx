"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { useAction, useMutation } from "convex/react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

import { cn } from "@/shared/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  ChangeHistoryIcon,
  ContrastIcon,
  DarkModeIcon,
  FolderCopyIcon,
  FolderIcon,
  FramePersonIcon,
  HomeIcon,
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
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import { useWorkspaceTransition } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import { toast } from "sonner";
import { useStore } from "@nanostores/react";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  $preferredShellContext,
  setPreferredShellContext,
} from "@/shared/stores/preferredShellContext";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";

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
    const { pageLabels, routes } = useActiveUseCaseLabels();
    const router = useRouter();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);
    const startCheckoutFlow = useAction(api.billing.startCheckoutFlow);
    const { startTransition, completeTransition, resetTransition } =
      useWorkspaceTransition();
    const locked = useStore($onboardingLock);
    const preferredShellContext = useStore($preferredShellContext);
    const { modal, requestNewWorkspace } = useNewWorkspaceDraftFlow({
      enabled: Boolean(user) && !locked,
    });

    // Get current user plan
    const planQuery = useQueryWithStatus(
      api.plans.getCurrentPlan,
      user ? {} : "skip"
    );
    const workspaceCreationEligibilityQuery = useQueryWithStatus(
      api.plans.getWorkspaceCreationEligibility,
      user ? {} : "skip"
    );
    const subscriptionQuery = useQueryWithStatus(
      api.polar.getSubscription,
      user ? {} : "skip"
    );

    // Get user workspaces
    const shellStateQuery = useQueryWithStatus(
      api.shell.getAppShellState,
      user ? {} : "skip"
    );
    const plan = planQuery.data;
    const subscription = subscriptionQuery.data;
    const workspaceCreationEligibility = workspaceCreationEligibilityQuery.data;
    const shellState = shellStateQuery.data;

    // Allow overriding the rendered element
    const Comp = asChild ? Slot : "header";

    // Derive tier and workspace info
    const tier = plan?.tier ?? "free";
    const isFree = tier === "free";
    const displayName = user?.firstName || user?.email || "User";
    const displayImage = user?.profilePictureUrl;

    // Use real workspaces from query
    const workspaces = React.useMemo(
      () => shellState?.switcherItems ?? [],
      [shellState?.switcherItems]
    );
    const hasMultipleWorkspaces = workspaces.length > 1;
    const defaultActiveWorkspaceId =
      workspaces.find((candidate) => candidate.isActive)?.value ?? "";
    const activeWorkspaceId =
      preferredShellContext === "workspace" && shellState?.activeWorkspaceId
        ? shellState.activeWorkspaceId
        : preferredShellContext === "setup_session" &&
            shellState?.activeSetupSessionId
          ? shellState.activeSetupSessionId
          : defaultActiveWorkspaceId;
    const [optimisticWorkspaceId, setOptimisticWorkspaceId] =
      React.useState<string>(activeWorkspaceId);
    const [isSwitchingWorkspace, setIsSwitchingWorkspace] =
      React.useState(false);
    const [isStartingUpgrade, setIsStartingUpgrade] = React.useState(false);
    const selectedWorkspaceId = optimisticWorkspaceId || activeWorkspaceId;
    const workspaceName =
      workspaces.find((candidate) => candidate.value === selectedWorkspaceId)
        ?.label ||
      workspace?.name ||
      "No workspace yet";
    const canCreateWorkspace = workspaceCreationEligibility?.allowed === true;
    const workspaceCreationBlockedReason =
      workspaceCreationEligibility?.reason ??
      (workspaceCreationEligibilityQuery.isError
        ? "Workspace data is temporarily unavailable."
        : "Workspace limit reached for your current plan.");
    const showUpgradeCta =
      tier !== "pro" &&
      (isFree || workspaceCreationEligibility?.allowed === false);
    const isHeaderLoading =
      loading ||
      (!!user &&
        (planQuery.isPending ||
          workspaceCreationEligibilityQuery.isPending ||
          shellStateQuery.isPending));

    React.useEffect(() => {
      if (!isSwitchingWorkspace) {
        setOptimisticWorkspaceId(activeWorkspaceId);
      }
    }, [activeWorkspaceId, isSwitchingWorkspace]);

    const handleUpgradeCheckout = React.useCallback(async () => {
      if (locked || isStartingUpgrade || typeof window === "undefined") {
        return;
      }

      const currentUrl = new URL(window.location.href);
      setIsStartingUpgrade(true);
      try {
        const { url } = await startCheckoutFlow({
          tier: isFree ? "base" : "pro",
          billingPeriod:
            subscription?.recurringInterval === "year" ? "yearly" : "monthly",
          source: "header_upgrade",
          origin: currentUrl.origin,
          returnTo: `${currentUrl.pathname}${currentUrl.search}`,
        });
        window.location.assign(url);
      } catch (error) {
        toast.error("Could not start checkout", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
        setIsStartingUpgrade(false);
      }
    }, [
      isFree,
      isStartingUpgrade,
      locked,
      startCheckoutFlow,
      subscription?.recurringInterval,
    ]);

    const handleWorkspaceSwitch = React.useCallback(
      async (workspaceId: string) => {
        if (
          !workspaceId ||
          isSwitchingWorkspace ||
          workspaceId === selectedWorkspaceId
        ) {
          return;
        }

        const targetItem = workspaces.find(
          (candidate) => candidate.value === workspaceId
        );
        if (!targetItem) {
          return;
        }

        if (targetItem.kind === "draft") {
          setPreferredShellContext("setup_session");
          router.push(
            `/agent/setup?sessionId=${targetItem.sessionId}&threadId=${encodeURIComponent(targetItem.threadId)}`
          );
          return;
        }

        const targetWorkspaceName = targetItem.label;
        const previousPreferredShellContext = preferredShellContext;

        setOptimisticWorkspaceId(workspaceId);
        setIsSwitchingWorkspace(true);
        startTransition("switching_workspace");
        setPreferredShellContext("workspace");

        try {
          await setDefaultWorkspace({
            workspaceId: targetItem.workspaceId as Id<"workspaces">,
          });
          if (pathname === "/agent/setup") {
            router.replace("/");
          } else {
            router.refresh();
          }
          completeTransition();
          toast.success("Workspace switched", {
            description: `Now using ${targetWorkspaceName}.`,
          });
        } catch (error) {
          setOptimisticWorkspaceId(activeWorkspaceId);
          setPreferredShellContext(previousPreferredShellContext);
          resetTransition();
          toast.error("Couldn't switch workspace", {
            description: "Please try again.",
          });
          console.error("[Header] Failed to switch workspace:", error);
        } finally {
          setIsSwitchingWorkspace(false);
        }
      },
      [
        activeWorkspaceId,
        completeTransition,
        isSwitchingWorkspace,
        pathname,
        preferredShellContext,
        resetTransition,
        router,
        selectedWorkspaceId,
        setDefaultWorkspace,
        startTransition,
        workspaces,
      ]
    );

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
    if (isHeaderLoading) {
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
                disabled={locked}
                asChild={!locked}
                aria-label="Notifications"
                className="relative"
              >
                {locked ? (
                  <>
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
                  </>
                ) : (
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
                )}
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

                  {/* Upgrade CTA (free users, or paid users at workspace limit) */}
                  {showUpgradeCta && (
                    <>
                      <DropdownMenuItem
                        disabled={locked || isStartingUpgrade}
                        onSelect={(event) => {
                          event.preventDefault();
                          void handleUpgradeCheckout();
                        }}
                      >
                        <UpgradeIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {isFree
                          ? "Upgrade plan"
                          : "Upgrade for more workspaces"}
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {/* Navigation: workspace entities, converts, archive */}
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <FramePersonIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.entities}
                      </>
                    ) : (
                      <Link href="/">
                        <FramePersonIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.entities}
                      </Link>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <AccountBoxIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.converts}
                      </>
                    ) : (
                      <Link href={routes.successHref}>
                        <AccountBoxIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.converts}
                      </Link>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <ArchiveIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.archives}
                      </>
                    ) : (
                      <Link href="/archives">
                        <ArchiveIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.archives}
                      </Link>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Analytics */}
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <BidLandscapeIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.analytics}
                      </>
                    ) : (
                      <Link href="/analytics">
                        <BidLandscapeIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        {pageLabels.analytics}
                      </Link>
                    )}
                  </DropdownMenuItem>

                  {/* Agent Ops */}
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <ChangeHistoryIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        Agent Ops
                      </>
                    ) : (
                      <Link href="/agent-ops">
                        <ChangeHistoryIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        Agent Ops
                      </Link>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Connected accounts */}
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <ManageAccountsIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        Connected accounts
                      </>
                    ) : (
                      <Link href="/settings/connected-accounts">
                        <ManageAccountsIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        Connected accounts
                      </Link>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Current workspace */}
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <FolderIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        <span className="truncate">{workspaceName}</span>
                      </>
                    ) : (
                      <Link href="/workspace">
                        <FolderIcon
                          className="fill-current"
                          aria-hidden="true"
                        />
                        <span className="truncate">{workspaceName}</span>
                      </Link>
                    )}
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
                            value={selectedWorkspaceId}
                            onValueChange={(id) => {
                              void handleWorkspaceSwitch(id);
                            }}
                          >
                            {workspaces.map((ws) => (
                              <DropdownMenuRadioItem
                                key={ws.value}
                                value={ws.value}
                                disabled={isSwitchingWorkspace}
                              >
                                {ws.label}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                          {canCreateWorkspace && !isSwitchingWorkspace ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={locked}
                                onClick={() => void requestNewWorkspace()}
                              >
                                <AddIcon
                                  className="fill-current"
                                  aria-hidden="true"
                                />
                                New workspace
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled
                                title={
                                  isSwitchingWorkspace
                                    ? "Workspace switch in progress"
                                    : workspaceCreationBlockedReason
                                }
                              >
                                <AddIcon
                                  className="fill-current"
                                  aria-hidden="true"
                                />
                                New workspace
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  ) : !isFree ? (
                    canCreateWorkspace && !isSwitchingWorkspace ? (
                      <DropdownMenuItem
                        disabled={locked}
                        onClick={() => void requestNewWorkspace()}
                      >
                        <AddIcon className="fill-current" aria-hidden="true" />
                        New workspace
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled
                        title={
                          isSwitchingWorkspace
                            ? "Workspace switch in progress"
                            : workspaceCreationBlockedReason
                        }
                      >
                        <AddIcon className="fill-current" aria-hidden="true" />
                        New workspace
                      </DropdownMenuItem>
                    )
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
                  <DropdownMenuItem disabled={locked} asChild={!locked}>
                    {locked ? (
                      <>
                        <HomeIcon className="fill-current" aria-hidden="true" />
                        Home page
                      </>
                    ) : (
                      <Link href="/home">
                        <HomeIcon className="fill-current" aria-hidden="true" />
                        Home page
                      </Link>
                    )}
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
        {modal}
      </Comp>
    );
  }
);

Header.displayName = "Header";
