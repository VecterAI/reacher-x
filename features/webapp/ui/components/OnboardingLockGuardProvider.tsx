"use client";

import { type ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@nanostores/react";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { $onboardingLock } from "@/shared/stores/onboarding";
import { $preferredShellContext } from "@/shared/stores/preferredShellContext";

const SETUP_ROUTE = "/agent/setup";

export function OnboardingLockGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preferredShellContext = useStore($preferredShellContext);
  const shellStateQuery = useQueryWithStatus(api.shell.getAppShellState);
  const workspaceStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus
  );
  const shellState = shellStateQuery.data;

  const currentQueryString = useMemo(
    () => searchParams.toString(),
    [searchParams]
  );
  const isWorkspacePreferredAndReady =
    preferredShellContext === "workspace" &&
    Boolean(shellState?.activeWorkspaceId) &&
    workspaceStatusQuery.data?.status === "complete";

  useEffect(() => {
    if (shellStateQuery.isError) {
      $onboardingLock.set(false);
      return;
    }
    if (!shellState) return;
    $onboardingLock.set(
      isWorkspacePreferredAndReady ? false : shellState.locked
    );
  }, [isWorkspacePreferredAndReady, shellState, shellStateQuery.isError]);

  useEffect(() => {
    return () => {
      $onboardingLock.set(false);
    };
  }, []);

  useEffect(() => {
    if (!shellStateQuery.isSuccess || !shellState) return;

    const locked = isWorkspacePreferredAndReady ? false : shellState.locked;
    const allowUnlockedSetupRoute =
      new URLSearchParams(currentQueryString).get("action") === "newWorkspace";
    const targetLockedUrl = shellState.redirect.href;
    const targetLockedQuery = targetLockedUrl.includes("?")
      ? targetLockedUrl.split("?")[1]
      : "";

    if (locked && pathname !== SETUP_ROUTE) {
      router.replace(targetLockedUrl);
      return;
    }

    if (
      locked &&
      pathname === SETUP_ROUTE &&
      currentQueryString !== targetLockedQuery
    ) {
      router.replace(targetLockedUrl);
      return;
    }

    if (!locked && pathname === SETUP_ROUTE && !allowUnlockedSetupRoute) {
      router.replace("/");
    }
  }, [
    shellState,
    shellStateQuery.isSuccess,
    isWorkspacePreferredAndReady,
    pathname,
    currentQueryString,
    router,
  ]);

  return <>{children}</>;
}
