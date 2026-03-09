"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useMutation } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { $onboardingLock } from "@/shared/stores/onboarding";

const SETUP_ROUTE = "/agent/setup";

function getLockedAgentUrl(onboardingThreadId: string | null): string {
  if (!onboardingThreadId) {
    return SETUP_ROUTE;
  }
  const params = new URLSearchParams();
  params.set("threadId", onboardingThreadId);
  return `${SETUP_ROUTE}?${params.toString()}`;
}

export function OnboardingLockGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigationStateQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceNavigationState
  );
  const navigationState = navigationStateQuery.data;
  const resolveOnboardingThread = useMutation(
    api.workspaces.resolveOnboardingThreadForDefaultWorkspace
  );
  const hasRequestedResolveRef = useRef(false);
  const lastWorkspaceIdRef = useRef<string | null>(null);
  const lockState = navigationState?.lockState;
  const onboardingThreadId = navigationState?.onboardingThreadId;
  const workspaceId = navigationState?.workspaceId ?? null;

  const currentQueryString = useMemo(
    () => searchParams.toString(),
    [searchParams]
  );

  useEffect(() => {
    if (navigationStateQuery.isError) {
      $onboardingLock.set(false);
      return;
    }
    if (!lockState) return;
    $onboardingLock.set(lockState !== "ready");
  }, [lockState, navigationStateQuery.isError]);

  useEffect(() => {
    return () => {
      $onboardingLock.set(false);
    };
  }, []);

  useEffect(() => {
    if (!lockState) return;

    if (workspaceId !== lastWorkspaceIdRef.current) {
      lastWorkspaceIdRef.current = workspaceId;
      hasRequestedResolveRef.current = false;
    }

    const locked = lockState !== "ready";
    if (!locked || onboardingThreadId || !workspaceId) {
      hasRequestedResolveRef.current = false;
      return;
    }
    if (hasRequestedResolveRef.current) return;

    hasRequestedResolveRef.current = true;
    void resolveOnboardingThread({});
  }, [lockState, onboardingThreadId, workspaceId, resolveOnboardingThread]);

  useEffect(() => {
    if (!navigationStateQuery.isSuccess || !navigationState) return;

    const locked = navigationState.lockState !== "ready";
    const allowUnlockedSetupRoute =
      new URLSearchParams(currentQueryString).get("action") === "newWorkspace";
    const hasPersistedOnboardingThread = !!navigationState.onboardingThreadId;
    const targetLockedUrl = getLockedAgentUrl(
      navigationState.onboardingThreadId
    );
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
      hasPersistedOnboardingThread &&
      currentQueryString !== targetLockedQuery
    ) {
      router.replace(targetLockedUrl);
      return;
    }

    if (!locked && pathname === SETUP_ROUTE && !allowUnlockedSetupRoute) {
      router.replace("/");
    }
  }, [
    navigationState,
    navigationStateQuery.isSuccess,
    pathname,
    currentQueryString,
    router,
  ]);

  return <>{children}</>;
}
