"use client";

import { type ReactNode, useEffect, useMemo, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { usePreferredShellQueryArgs, useQueryWithStatus } from "@/shared/hooks";
import { $onboardingLock } from "@/shared/stores/onboarding";
import { usePreferredShellContext } from "@/shared/stores/preferredShellContext";

const SETUP_ROUTE = "/agent/setup";
const SETUP_AUTH_QUERY_KEYS = [
  "code",
  "state",
  "error",
  "error_description",
  "linkedin_status",
] as const;

function searchParamsRecord(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

function areSearchParamsEquivalent(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const A = searchParamsRecord(a);
  const B = searchParamsRecord(b);
  const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
  for (const k of keys) {
    if (A[k] !== B[k]) {
      return false;
    }
  }
  return true;
}

function hasSetupAuthResultParams(queryString: string): boolean {
  const params = new URLSearchParams(queryString);
  return SETUP_AUTH_QUERY_KEYS.some((key) => params.has(key));
}

type ShellLockFields = {
  activeContextType: "workspace" | "setup_session" | null;
  locked: boolean;
};

function deriveEffectiveLocked(
  shellState: ShellLockFields,
  isWorkspacePreferredAndReady: boolean
): boolean {
  if (shellState.activeContextType === "setup_session") {
    return shellState.locked;
  }
  if (isWorkspacePreferredAndReady) {
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
  const preferredShellContext = usePreferredShellContext();
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
      deriveEffectiveLocked(shellState, isWorkspacePreferredAndReady)
    );
  }, [isWorkspacePreferredAndReady, shellState, shellStateQuery.isError]);

  useEffect(() => {
    return () => {
      $onboardingLock.set(false);
    };
  }, []);

  useEffect(() => {
    if (!shellStateQuery.isSuccess || !shellState) return;

    const locked = deriveEffectiveLocked(
      shellState,
      isWorkspacePreferredAndReady
    );
    const allowUnlockedSetupRoute =
      new URLSearchParams(currentQueryString).get("action") === "newWorkspace";
    const hasSetupAuthParams =
      pathname === SETUP_ROUTE && hasSetupAuthResultParams(currentQueryString);
    const targetLockedUrl = shellState.redirect.href;
    const targetLockedQuery = targetLockedUrl.includes("?")
      ? targetLockedUrl.split("?")[1]
      : "";

    if (hasSetupAuthParams) {
      return;
    }

    if (locked && pathname !== SETUP_ROUTE) {
      startTransition(() => {
        router.replace(targetLockedUrl);
      });
      return;
    }

    const shellWantsBareSetup =
      targetLockedUrl === SETUP_ROUTE || targetLockedUrl === `${SETUP_ROUTE}?`;

    if (
      locked &&
      pathname === SETUP_ROUTE &&
      !areSearchParamsEquivalent(currentQueryString, targetLockedQuery)
    ) {
      if (
        shellWantsBareSetup &&
        shellState.activeContextType !== "setup_session"
      ) {
        const c = new URLSearchParams(currentQueryString);
        if (c.has("threadId")) {
          return;
        }
      }
      startTransition(() => {
        router.replace(targetLockedUrl);
      });
      return;
    }

    if (!locked && pathname === SETUP_ROUTE && !allowUnlockedSetupRoute) {
      startTransition(() => {
        router.replace("/");
      });
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
