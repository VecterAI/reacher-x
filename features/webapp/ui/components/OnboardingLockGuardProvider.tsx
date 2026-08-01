"use client";

import { type ReactNode, useEffect, useMemo, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { usePreferredShellQueryArgs, useQueryWithStatus } from "@/shared/hooks";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  resolveOnboardingNavigationAction,
  SETUP_PREVIEW_ROUTE,
} from "@/features/webapp/lib/onboardingNavigationCore";

type ShellLockFields = {
  activeContextType: "workspace" | "setup_session" | null;
  locked: boolean;
};

function deriveEffectiveLocked(
  shellState: ShellLockFields,
  isWorkspaceContextReady: boolean
): boolean {
  if (shellState.activeContextType === "setup_session") {
    return shellState.locked;
  }
  if (isWorkspaceContextReady) {
    return false;
  }
  return shellState.locked;
}

export function OnboardingLockGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );
  const workspaceStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    preferredShellQueryArgs
  );
  const shellState = shellStateQuery.data;

  const currentQueryString = useMemo(
    () => searchParams.toString(),
    [searchParams]
  );
  const isWorkspaceContextReady =
    shellState?.activeContextType === "workspace" &&
    Boolean(shellState?.activeWorkspaceId) &&
    workspaceStatusQuery.data?.status === "complete";

  useEffect(() => {
    if (shellStateQuery.isError) {
      $onboardingLock.set(false);
      return;
    }
    if (!shellState) return;
    $onboardingLock.set(
      deriveEffectiveLocked(shellState, isWorkspaceContextReady)
    );
  }, [isWorkspaceContextReady, shellState, shellStateQuery.isError]);

  useEffect(() => {
    return () => {
      $onboardingLock.set(false);
    };
  }, []);

  useEffect(() => {
    if (!shellStateQuery.isSuccess || !shellState) return;

    const locked = deriveEffectiveLocked(shellState, isWorkspaceContextReady);
    const navigationAction = resolveOnboardingNavigationAction({
      activeContextType: shellState.activeContextType,
      currentQueryString,
      isDevelopmentSetupPreview:
        process.env.NODE_ENV === "development" &&
        pathname === SETUP_PREVIEW_ROUTE,
      locked,
      pathname,
      targetLockedUrl: shellState.redirect.href,
    });

    if (navigationAction.kind === "replace") {
      startTransition(() => router.replace(navigationAction.href));
    }
  }, [
    shellState,
    shellStateQuery.isSuccess,
    isWorkspaceContextReady,
    pathname,
    currentQueryString,
    router,
  ]);

  return <>{children}</>;
}
