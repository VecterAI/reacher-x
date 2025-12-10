// app/(webapp)/page.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AgentChat } from "@/features/agent/ui/AgentChat";
import { ProspectResults } from "@/features/agent/ui/ProspectResults";

// ============================================================================
// Type for workspace setup status
// ============================================================================

type WorkspaceSetupStatus =
  | { status: "unauthenticated" }
  | { status: "no_user" }
  | { status: "no_workspace" }
  | {
      status: "needs_icp";
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        hasDescription: boolean;
      };
    }
  | {
      status: "complete";
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        icp: string[];
      };
    };

// ============================================================================
// Main Page Component
// ============================================================================

export default function WebAppPage() {
  // Get workspace setup status
  const setupStatus = useQuery(
    api.workspaces.getWorkspaceSetupStatus
  ) as WorkspaceSetupStatus | undefined;

  // Determine current workspace ID (if any)
  const workspaceId: Id<"workspaces"> | null =
    setupStatus?.status === "complete" || setupStatus?.status === "needs_icp"
      ? setupStatus.workspace.id
      : null;

  // Query prospects to determine if we should show the right panel
  const prospectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId ? { workspaceId, limit: 1 } : "skip"
  );

  // Only show right panel when there are actual prospects
  const hasProspects = (prospectsData?.total ?? 0) > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden md:flex-row">
      {/* Agent Chat - has built-in max-w-lg and border styling */}
      <AgentChat />

      {/* Right Panel: Prospect Results - only visible when there are prospects */}
      {hasProspects && (
        <div className="flex h-1/2 flex-col md:h-full md:flex-1">
          <ProspectResults workspaceId={workspaceId} />
        </div>
      )}
    </div>
  );
}
