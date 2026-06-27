"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation } from "convex/react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Separator } from "@/shared/ui/components/Separator";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { LandingWordmark } from "@/features/landing/ui/components/LandingWordmark";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/shared/ui/components/DropdownMenu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerClose,
} from "@/shared/ui/components/Drawer";
import {
  GitHubIcon,
  ChangeCircleIcon,
  LightModeIcon,
  DarkModeIcon,
  ContrastIcon,
  LogoutIcon,
  ArrowOutwardIcon,
  TwitterIcon,
  DiscordIcon,
  LinkedinIcon,
  BlueskyIcon,
  ThreadsIcon,
  AccountBoxIcon,
  AddIcon,
  ArchiveIcon,
  BidLandscapeIcon,
  ChangeHistoryIcon,
  CheckIcon,
  CreditCardIcon,
  FolderCopyIcon,
  FolderIcon,
  FramePersonIcon,
  LockIcon,
  ManageAccountsIcon,
  MailIcon,
  UpgradeIcon,
} from "@/shared/ui/components/icons";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth as useAppAuth } from "@/shared/hooks/useAuth";
import { usePreferredShellQueryArgs, useQueryWithStatus } from "@/shared/hooks";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  setPreferredShellContext,
  usePreferredShellContext,
} from "@/shared/stores/preferredShellContext";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";
import { getPlansUpgradeHref } from "@/features/billing/lib/plansUpgradeUrl";
import {
  getWorkspaceUseCase,
  DEFAULT_WORKSPACE_USE_CASE_KEY,
} from "@/shared/lib/workspaceUseCases";
import { getWorkspaceRoutes } from "@/shared/lib/workspaceRoutes";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const NAV_LINKS = [
  { href: "/use-cases", label: "Use cases", isAnchor: false },
  { href: "/threads", label: "Threads", isAnchor: false },
  {
    href: "mailto:creativecoder.crco@gmail.com",
    label: "Contact",
    isAnchor: true,
  },
  { href: "/pricing", label: "Pricing", isAnchor: false },
] as const;

function isLinkActive(href: string, pathname: string): boolean {
  if (href.startsWith("#") || href.startsWith("mailto:")) return false;
  if (href === pathname) return true;
  return pathname.startsWith(href + "/");
}

/* -------------------------------------------------------------------------- */
/*  GitHub Button                                                             */
/* -------------------------------------------------------------------------- */

function GitHubButton({ starsCount }: { starsCount: number }) {
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ReacherX on GitHub (${starsCount} stars)`}
      className={cn(
        buttonVariants({ variant: "ghost", size: "xs" }),
        "gap-1.5"
      )}
    >
      <GitHubIcon className="fill-current" />
      <AnimatedNumber
        value={starsCount}
        animateOnMount
        format={{ useGrouping: true }}
        className="text-sm"
      />
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/*  Avatar Dropdown (authenticated — mirrors app dropdown)                    */
/* -------------------------------------------------------------------------- */

type WorkspaceSwitcherItem = {
  value: string;
  label: string;
  isActive?: boolean;
  locked?: boolean;
  kind?: "draft" | "workspace" | string;
  workspaceId?: string;
  sessionId?: string;
  threadId?: string;
};

function AvatarDropdown({
  user,
}: {
  user: {
    firstName?: string | null;
    email?: string | null;
    profilePictureUrl?: string | null;
  };
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { workspace } = useAppAuth();
  const locked = useStore($onboardingLock);
  const preferredShellContext = usePreferredShellContext();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);
  const { modal, requestNewWorkspace } = useNewWorkspaceDraftFlow({
    enabled: Boolean(user) && !locked,
  });

  const planQuery = useQueryWithStatus(
    api.plans.getCurrentPlan,
    user ? {} : "skip"
  );
  const workspaceCreationEligibilityQuery = useQueryWithStatus(
    api.plans.getWorkspaceCreationEligibility,
    user ? {} : "skip"
  );
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    user ? preferredShellQueryArgs : "skip"
  );

  const plan = planQuery.data;
  const workspaceCreationEligibility = workspaceCreationEligibilityQuery.data;
  const shellState = shellStateQuery.data;

  const displayName = user.firstName || user.email || "User";
  const displayImage = user.profilePictureUrl;
  const tier = plan?.tier ?? "free";
  const isFree = tier === "free";
  const isHighestTier = tier === "pro";
  const tierLabel =
    tier === "free"
      ? "Plan required"
      : tier === "hobby"
        ? "Hobby"
        : tier === "base"
          ? "Base"
          : "Pro";
  const showUpgradeCta =
    tier !== "pro" &&
    (isFree || workspaceCreationEligibility?.allowed === false);
  const hasLockedItems = shellState?.showUnlockCta ?? false;
  const canCreateWorkspace = workspaceCreationEligibility?.allowed === true;

  // Derive use-case labels from workspace
  const useCase = workspace
    ? getWorkspaceUseCase(workspace.useCaseKey)
    : getWorkspaceUseCase(DEFAULT_WORKSPACE_USE_CASE_KEY);
  const routes = getWorkspaceRoutes(useCase.key);
  const pageLabels = useCase.pageLabels;

  // Workspaces
  const workspaces = React.useMemo<WorkspaceSwitcherItem[]>(
    () => (shellState?.switcherItems ?? []) as WorkspaceSwitcherItem[],
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
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = React.useState(false);
  const selectedWorkspaceId = optimisticWorkspaceId || activeWorkspaceId;
  const workspaceName =
    workspaces.find((candidate) => candidate.value === selectedWorkspaceId)
      ?.label ||
    shellState?.activeSetupSession?.displayName ||
    workspace?.name ||
    "No workspace yet";

  React.useEffect(() => {
    if (!isSwitchingWorkspace) {
      setOptimisticWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, isSwitchingWorkspace]);

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
      if (!targetItem) return;

      if (targetItem.locked) {
        router.push(getPlansUpgradeHref());
        return;
      }

      if (targetItem.kind === "draft" && targetItem.threadId) {
        setPreferredShellContext("setup_session");
        router.push(buildSetupHref(targetItem.threadId));
        return;
      }

      const targetWorkspaceName = targetItem.label;
      setOptimisticWorkspaceId(workspaceId);
      setIsSwitchingWorkspace(true);
      setPreferredShellContext("workspace");

      try {
        await setDefaultWorkspace({
          workspaceId: targetItem.workspaceId as Id<"workspaces">,
        });
        router.refresh();
        toast.success("Workspace switched", {
          description: `Now using ${targetWorkspaceName}.`,
        });
      } catch {
        setOptimisticWorkspaceId(activeWorkspaceId);
        toast.error("Couldn't switch workspace", {
          description: "Please try again.",
        });
      } finally {
        setIsSwitchingWorkspace(false);
      }
    },
    [
      activeWorkspaceId,
      isSwitchingWorkspace,
      router,
      selectedWorkspaceId,
      setDefaultWorkspace,
      workspaces,
    ]
  );

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

  const newWorkspaceItem =
    canCreateWorkspace && !isSwitchingWorkspace ? (
      <DropdownMenuItem
        disabled={locked}
        onClick={() => void requestNewWorkspace()}
      >
        <AddIcon className="fill-current" aria-hidden="true" />
        New workspace
      </DropdownMenuItem>
    ) : !isHighestTier && !canCreateWorkspace ? (
      <DropdownMenuItem
        disabled={locked}
        onSelect={(event) => {
          event.preventDefault();
          if (locked) return;
          router.push(getPlansUpgradeHref());
        }}
      >
        <AddIcon className="fill-current" aria-hidden="true" />
        New workspace
      </DropdownMenuItem>
    ) : isHighestTier && !canCreateWorkspace ? (
      <DropdownMenuItem disabled>
        <AddIcon className="fill-current" aria-hidden="true" />
        New workspace
      </DropdownMenuItem>
    ) : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="User menu">
            <Avatar className="size-8">
              <AvatarImage src={displayImage || ""} alt={displayName} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
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

          {/* Upgrade CTA */}
          {showUpgradeCta && (
            <DropdownMenuItem
              disabled={locked}
              onSelect={(event) => {
                event.preventDefault();
                router.push(getPlansUpgradeHref());
              }}
            >
              <UpgradeIcon className="fill-current" aria-hidden="true" />
              {isFree ? "Upgrade plan" : "Upgrade for more workspaces"}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              People
            </DropdownMenuLabel>
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
                  <AccountBoxIcon className="fill-current" aria-hidden="true" />
                  {pageLabels.converts}
                </>
              ) : (
                <Link href={routes.successHref}>
                  <AccountBoxIcon className="fill-current" aria-hidden="true" />
                  {pageLabels.converts}
                </Link>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={locked} asChild={!locked}>
              {locked ? (
                <>
                  <ArchiveIcon className="fill-current" aria-hidden="true" />
                  {pageLabels.archives}
                </>
              ) : (
                <Link href="/archives">
                  <ArchiveIcon className="fill-current" aria-hidden="true" />
                  {pageLabels.archives}
                </Link>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Insights
            </DropdownMenuLabel>
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
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Accounts
            </DropdownMenuLabel>
            <DropdownMenuItem disabled={locked} asChild={!locked}>
              {locked ? (
                <>
                  <CreditCardIcon className="fill-current" aria-hidden="true" />
                  Plans
                </>
              ) : (
                <Link href="/plans">
                  <CreditCardIcon className="fill-current" aria-hidden="true" />
                  Plans
                </Link>
              )}
            </DropdownMenuItem>
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
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Workspace
            </DropdownMenuLabel>
            <DropdownMenuItem disabled={locked} asChild={!locked}>
              {locked ? (
                <>
                  <FolderIcon className="fill-current" aria-hidden="true" />
                  <span className="truncate">{workspaceName}</span>
                </>
              ) : (
                <Link href="/workspace">
                  <FolderIcon className="fill-current" aria-hidden="true" />
                  <span className="truncate">{workspaceName}</span>
                </Link>
              )}
            </DropdownMenuItem>

            {hasMultipleWorkspaces ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderCopyIcon className="fill-current" aria-hidden="true" />
                  Workspaces
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {workspaces.map((ws: WorkspaceSwitcherItem) => (
                      <DropdownMenuItem
                        key={ws.value}
                        disabled={ws.locked || isSwitchingWorkspace}
                        onSelect={(event) => {
                          event.preventDefault();
                          if (ws.locked) {
                            router.push(getPlansUpgradeHref());
                            return;
                          }
                          void handleWorkspaceSwitch(ws.value);
                        }}
                      >
                        {ws.locked ? (
                          <LockIcon
                            className="fill-current"
                            aria-hidden="true"
                          />
                        ) : ws.isActive ? (
                          <CheckIcon
                            className="fill-current"
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="size-4 shrink-0" />
                        )}
                        <span className="truncate">{ws.label}</span>
                      </DropdownMenuItem>
                    ))}
                    {hasLockedItems ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            router.push(getPlansUpgradeHref());
                          }}
                        >
                          <LockIcon
                            className="fill-current"
                            aria-hidden="true"
                          />
                          {shellState?.unlockCtaLabel ?? "Unlock workspaces"}
                        </DropdownMenuItem>
                      </>
                    ) : canCreateWorkspace && !isSwitchingWorkspace ? (
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
                    ) : !isHighestTier && !canCreateWorkspace ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={locked}
                          onSelect={(event) => {
                            event.preventDefault();
                            router.push(getPlansUpgradeHref());
                          }}
                        >
                          <AddIcon
                            className="fill-current"
                            aria-hidden="true"
                          />
                          New workspace
                        </DropdownMenuItem>
                      </>
                    ) : isHighestTier && !canCreateWorkspace ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>
                          <AddIcon
                            className="fill-current"
                            aria-hidden="true"
                          />
                          New workspace
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ) : hasLockedItems ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  router.push(getPlansUpgradeHref());
                }}
              >
                <LockIcon className="fill-current" aria-hidden="true" />
                {shellState?.unlockCtaLabel ?? "Unlock workspaces"}
              </DropdownMenuItem>
            ) : (
              newWorkspaceItem
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Theme */}
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <ContrastIcon className="fill-current" aria-hidden="true" />
            Theme
            <span className="ml-auto">{themeToggle}</span>
          </DropdownMenuItem>

          {/* Reach out/feedback */}
          <DropdownMenuItem asChild>
            <a href="mailto:creativecoder.crco@gmail.com">
              <MailIcon className="fill-current" aria-hidden="true" />
              Reach out/feedback
            </a>
          </DropdownMenuItem>

          {/* Dashboard (contextual — this is "Home page" in the app header) */}
          <DropdownMenuItem asChild>
            <Link href="/">
              <ArrowOutwardIcon className="fill-current" aria-hidden="true" />
              Dashboard
            </Link>
          </DropdownMenuItem>

          {/* Log out */}
          <DropdownMenuItem onClick={() => router.push("/logout")}>
            <LogoutIcon className="fill-current" aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {modal}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                    */
/* -------------------------------------------------------------------------- */

export function Header({ githubStarsCount }: { githubStarsCount: number }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "bg-background sticky top-0 z-50 flex items-center justify-between py-2 transition-[border-color] duration-200 md:py-3",
        scrolled ? "border-border border-b" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex w-full max-w-[1288px] items-center justify-between px-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Left side: Brand */}
        <div className="flex min-w-0 items-center gap-4 justify-self-start">
          <LandingWordmark />
        </div>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-6 justify-self-center md:flex"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map(({ href, label, isAnchor }) => {
            const active = isLinkActive(href, pathname);
            const cls = cn(
              "text-sm font-medium transition-colors underline-offset-[6px] decoration-2",
              active
                ? "text-foreground underline"
                : "text-muted-foreground hover:text-foreground"
            );

            return isAnchor ? (
              <a key={href} href={href} className={cls}>
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className={cls}>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop right side */}
        <div className="hidden min-w-[184px] items-center justify-end gap-2 justify-self-end md:flex">
          <GitHubButton starsCount={githubStarsCount} />
          <Separator orientation="vertical" className="h-6" />

          {/* Auth area */}
          <div className="flex min-h-10 items-center gap-2">
            {loading ? (
              <Skeleton className="h-10 w-10 rounded-full" />
            ) : user ? (
              <AvatarDropdown user={user} />
            ) : (
              <>
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "default", size: "xs" })}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile right side */}
        <div className="flex items-center gap-2 md:hidden">
          <GitHubButton starsCount={githubStarsCount} />
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            Menu
          </Button>
          {!loading && user && <AvatarDropdown user={user} />}
        </div>

        {/* Mobile Drawer */}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent>
            <aside aria-label="Mobile navigation">
              <DrawerHeader className="flex items-center justify-between p-4">
                <DrawerTitle>Menu</DrawerTitle>
                <Button
                  variant="ghost"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close navigation menu"
                >
                  Close
                </Button>
              </DrawerHeader>

              <menu className="flex flex-col items-start px-4 pb-4">
                {/* Unauthenticated: auth actions above nav */}
                {!loading && !user && (
                  <>
                    <li>
                      <DrawerClose asChild>
                        <Link
                          href="/login"
                          className="text-foreground py-2 text-xl font-normal hover:underline"
                        >
                          Log in
                        </Link>
                      </DrawerClose>
                    </li>
                    <li>
                      <DrawerClose asChild>
                        <Link
                          href="/login"
                          className="text-foreground py-2 text-xl font-normal hover:underline"
                        >
                          Sign up
                        </Link>
                      </DrawerClose>
                    </li>
                    <Separator className="my-4" />
                  </>
                )}

                {NAV_LINKS.map(({ href, label, isAnchor }) => {
                  const active = isLinkActive(href, pathname);
                  return (
                    <li key={href}>
                      <DrawerClose asChild>
                        {isAnchor ? (
                          <a
                            href={href}
                            className={cn(
                              "py-2 text-xl font-normal",
                              active
                                ? "text-foreground underline decoration-2 underline-offset-4"
                                : "text-muted-foreground hover:underline"
                            )}
                          >
                            {label}
                          </a>
                        ) : (
                          <Link
                            href={href}
                            className={cn(
                              "py-2 text-xl font-normal",
                              active
                                ? "text-foreground underline decoration-2 underline-offset-4"
                                : "text-muted-foreground hover:underline"
                            )}
                          >
                            {label}
                          </Link>
                        )}
                      </DrawerClose>
                    </li>
                  );
                })}
              </menu>

              <DrawerFooter>
                <small className="text-muted-foreground text-sm font-medium">
                  Follow on
                </small>
                <div className="flex items-center">
                  <SocialLink
                    href="https://x.com/ReacherXfounder"
                    label="X/Twitter"
                  >
                    <TwitterIcon />
                  </SocialLink>
                  <SocialLink
                    href="https://discord.gg/76dF9NPH"
                    label="Discord"
                  >
                    <DiscordIcon className="fill-current" />
                  </SocialLink>
                  <SocialLink
                    href="https://www.linkedin.com/in/noobships"
                    label="LinkedIn"
                  >
                    <LinkedinIcon className="fill-current" />
                  </SocialLink>
                  <SocialLink
                    href="https://bsky.app/profile/reacherxfounder.bsky.social"
                    label="Bluesky"
                  >
                    <BlueskyIcon className="stroke-current" />
                  </SocialLink>
                  <SocialLink
                    href="https://threads.net/@reacherxfounder"
                    label="Threads"
                  >
                    <ThreadsIcon className="fill-current" />
                  </SocialLink>
                </div>
              </DrawerFooter>
            </aside>
          </DrawerContent>
        </Drawer>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Social Link helper (footer of mobile drawer)                              */
/* -------------------------------------------------------------------------- */

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Button
        aria-label={`ReacherX on ${label}`}
        variant="ghost"
        size="icon"
        className="[&_svg]:size-8"
      >
        {children}
      </Button>
    </a>
  );
}
