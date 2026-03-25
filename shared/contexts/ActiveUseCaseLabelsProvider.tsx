"use client";

import { createContext, useContext, type ReactNode, useMemo } from "react";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

export type ActiveUseCaseLabelsContextValue = {
  /** From `cookies()` in the webapp layout — same on server and first client paint. */
  serverInitialUseCaseKey: WorkspaceUseCaseKey | null;
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

export function useActiveUseCaseLabelsContext(): ActiveUseCaseLabelsContextValue | null {
  return useContext(ActiveUseCaseLabelsContext);
}
