"use client";

import { useQueryWithStatus } from "@/shared/hooks";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Single `getProspect` subscription for agent UI (shell, history page, etc.).
 * Use one call per surface; pass the result into `AgentChat` via `shellProspectQuery` to avoid duplicate subscriptions.
 */
export function useAgentProspectQuery(prospectId: string | null | undefined) {
  return useQueryWithStatus(
    api.prospects.getProspect,
    prospectId ? { prospectId: prospectId as Id<"prospects"> } : "skip"
  );
}
