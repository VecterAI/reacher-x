/**
 * Demo shell context
 * Shares the active demo use case labels, the demo workspaces, and the
 * active workspace selection across the demo shell and all demo pages.
 * All state is local to the demo; no Convex, no routing.
 */
"use client";

import * as React from "react";
import { ScopedUseCaseLabelsProvider } from "@/shared/contexts/ActiveUseCaseLabelsProvider";
import { getDemoWorkspaceUseCaseKey } from "./demoLabels";
import { getDemoUseCaseLabels, type DemoUseCaseLabels } from "./demoLabels";
import type { UseCaseDemoKey } from "./useCaseDemoData";

export interface DemoWorkspace {
  id: string;
  name: string;
}

/**
 * Two workspaces per use case, named after what that user would actually
 * track, mirroring how real accounts separate goals by workspace.
 */
const DEMO_WORKSPACES_BY_USE_CASE: Record<UseCaseDemoKey, DemoWorkspace[]> = {
  customers: [
    { id: "saas_founders", name: "SaaS founders" },
    { id: "agency_clients", name: "Agency clients" },
  ],
  investors: [
    { id: "seed_investors", name: "Seed investors" },
    { id: "angel_syndicates", name: "Angel syndicates" },
  ],
  candidates: [
    { id: "engineering_hires", name: "Engineering hires" },
    { id: "design_hires", name: "Design hires" },
  ],
  creators: [
    { id: "youtube_creators", name: "YouTube creators" },
    { id: "podcast_guests", name: "Podcast guests" },
  ],
  job_seekers: [
    { id: "hiring_managers", name: "Hiring managers" },
    { id: "recruiters", name: "Recruiters" },
  ],
};

export function getDemoWorkspaces(key: UseCaseDemoKey): DemoWorkspace[] {
  return DEMO_WORKSPACES_BY_USE_CASE[key];
}

/** The demo user's own avatar (app header, agent thread user messages). */
export const DEMO_USER_AVATAR_URL =
  "https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=256&h=256&fit=crop&crop=faces&auto=format&q=80";

interface DemoShellContextValue {
  useCaseKey: UseCaseDemoKey;
  labels: DemoUseCaseLabels;
  workspaces: DemoWorkspace[];
  activeWorkspaceId: string;
  activeWorkspace: DemoWorkspace;
  setActiveWorkspaceId: (id: string) => void;
  pendingNotificationCount: number;
  initialWorkspaceMenuOpen?: boolean;
}

const DemoShellContext = React.createContext<DemoShellContextValue | null>(
  null
);

export function DemoShellProvider({
  useCaseKey,
  pendingNotificationCount,
  activeWorkspaceId,
  setActiveWorkspaceId,
  children,
  workspaces: suppliedWorkspaces,
  initialWorkspaceMenuOpen,
}: {
  useCaseKey: UseCaseDemoKey;
  pendingNotificationCount: number;
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  children: React.ReactNode;
  workspaces?: DemoWorkspace[];
  initialWorkspaceMenuOpen?: boolean;
}) {
  const value = React.useMemo<DemoShellContextValue>(() => {
    const workspaces = suppliedWorkspaces?.length
      ? suppliedWorkspaces
      : getDemoWorkspaces(useCaseKey);
    return {
      useCaseKey,
      labels: getDemoUseCaseLabels(useCaseKey),
      workspaces,
      activeWorkspaceId,
      activeWorkspace:
        workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
        workspaces[0],
      setActiveWorkspaceId,
      pendingNotificationCount,
      initialWorkspaceMenuOpen,
    };
  }, [
    useCaseKey,
    suppliedWorkspaces,
    initialWorkspaceMenuOpen,
    activeWorkspaceId,
    setActiveWorkspaceId,
    pendingNotificationCount,
  ]);

  return (
    <DemoShellContext.Provider value={value}>
      <ScopedUseCaseLabelsProvider
        useCaseKey={getDemoWorkspaceUseCaseKey(useCaseKey)}
      >
        {children}
      </ScopedUseCaseLabelsProvider>
    </DemoShellContext.Provider>
  );
}

export function useDemoShell() {
  const context = React.useContext(DemoShellContext);
  if (!context) {
    throw new Error("useDemoShell must be used within a DemoShellProvider");
  }
  return context;
}
