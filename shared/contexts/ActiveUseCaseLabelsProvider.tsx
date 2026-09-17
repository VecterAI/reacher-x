"use client";

import { createContext, useContext, type ReactNode, useMemo } from "react";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

export type ActiveUseCaseLabelsContextValue = {
  /** From `cookies()` in the webapp layout — same on server and first client paint. */
  serverInitialUseCaseKey: WorkspaceUseCaseKey | null;
  /** Explicit local surface scope, independent of the signed-in workspace. */
  scopedUseCaseKey?: WorkspaceUseCaseKey;
};

const ActiveUseCaseLabelsContext =
  createContext<ActiveUseCaseLabelsContextValue | null>(null);

export function ActiveUseCaseLabelsProvider({
  initialUseCaseKey,
  children,
}: {
  initialUseCaseKey: WorkspaceUseCaseKey | null;
  children: ReactNode;
}) {
  const value = useMemo<ActiveUseCaseLabelsContextValue>(
    () => ({ serverInitialUseCaseKey: initialUseCaseKey }),
    [initialUseCaseKey]
  );

  return (
    <ActiveUseCaseLabelsContext.Provider value={value}>
      {children}
    </ActiveUseCaseLabelsContext.Provider>
  );
}

/** Scope shared components to a local demonstration without changing workspace state. */
export function ScopedUseCaseLabelsProvider({
  useCaseKey,
  children,
}: {
  useCaseKey: WorkspaceUseCaseKey;
  children: ReactNode;
}) {
  const value = useMemo<ActiveUseCaseLabelsContextValue>(
    () => ({
      serverInitialUseCaseKey: null,
      scopedUseCaseKey: useCaseKey,
    }),
    [useCaseKey]
  );
  return (
    <ActiveUseCaseLabelsContext.Provider value={value}>
      {children}
    </ActiveUseCaseLabelsContext.Provider>
  );
}

export function useActiveUseCaseLabelsContext(): ActiveUseCaseLabelsContextValue | null {
  return useContext(ActiveUseCaseLabelsContext);
}
