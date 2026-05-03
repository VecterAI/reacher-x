import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { formatWorkspaceDraftName } from "../../shared/lib/workspaceDisplayNames";
import { getSetupStatusStepId, type SetupVisibleStepId } from "./setupFlowCore";

type SetupSessionDoc = Doc<"workspaceSetupSessions">;
type SetupSessionDb = QueryCtx["db"] | MutationCtx["db"];
type ActiveSetupSessionOptions = {
  includeRefine?: boolean;
};

export const TERMINAL_SETUP_SESSION_STATUSES = new Set<
  SetupSessionDoc["status"]
>(["ready", "failed", "discarded"]);

export function isTerminalSetupSessionStatus(
  status: SetupSessionDoc["status"]
): boolean {
  return TERMINAL_SETUP_SESSION_STATUSES.has(status);
}

export function isActiveSetupSession(
  session: SetupSessionDoc | null | undefined
): session is SetupSessionDoc {
  return Boolean(session && !isTerminalSetupSessionStatus(session.status));
}

function matchesActiveSetupSessionFilter(
  session: SetupSessionDoc,
  options?: ActiveSetupSessionOptions
): boolean {
  if (isTerminalSetupSessionStatus(session.status)) {
    return false;
  }

  if (options?.includeRefine === false && session.refineFromWorkspace) {
    return false;
  }

  return true;
}

function compareSessionsByRecency(
  a: SetupSessionDoc,
  b: SetupSessionDoc
): number {
  return (
    (b.lastActiveAt ?? b.statusUpdatedAt) -
    (a.lastActiveAt ?? a.statusUpdatedAt)
  );
}

export function hasSetupGenerationData(
  session: Pick<SetupSessionDoc, "improvedDescription" | "generatedProfiles">
): boolean {
  return (
    typeof session.improvedDescription === "string" &&
    session.improvedDescription.trim().length > 0 &&
    Array.isArray(session.generatedProfiles) &&
    session.generatedProfiles.length > 0
  );
}

export function getSetupSessionDisplayName(session: SetupSessionDoc): string {
  return formatWorkspaceDraftName(session);
}

export function getSetupSessionPanelStep(
  status: SetupSessionDoc["status"]
): SetupVisibleStepId {
  return getSetupStatusStepId(status);
}

export async function getActiveSetupSessionForUser(
  db: SetupSessionDb,
  userId: Id<"users">,
  options?: ActiveSetupSessionOptions
): Promise<SetupSessionDoc | null> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  return (
    sessions.find((session) =>
      matchesActiveSetupSessionFilter(session, options)
    ) ?? null
  );
}

export async function getSetupSessionByThreadId(
  db: SetupSessionDb,
  setupThreadId: string
): Promise<SetupSessionDoc | null> {
  return await db
    .query("workspaceSetupSessions")
    .withIndex("by_setup_thread", (q) => q.eq("setupThreadId", setupThreadId))
    .first();
}

export async function getSetupSessionByTargetWorkspaceId(
  db: SetupSessionDb,
  targetWorkspaceId: Id<"workspaces">
): Promise<SetupSessionDoc | null> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_target_workspace", (q) =>
      q.eq("targetWorkspaceId", targetWorkspaceId)
    )
    .collect();

  return sessions.sort(compareSessionsByRecency)[0] ?? null;
}

export async function getActiveSetupSessionByTargetWorkspaceId(
  db: SetupSessionDb,
  targetWorkspaceId: Id<"workspaces">,
  options?: ActiveSetupSessionOptions
): Promise<SetupSessionDoc | null> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_target_workspace", (q) =>
      q.eq("targetWorkspaceId", targetWorkspaceId)
    )
    .collect();

  return (
    sessions
      .sort(compareSessionsByRecency)
      .find((session) => matchesActiveSetupSessionFilter(session, options)) ??
    null
  );
}

export async function resolveNextSetupDraftOrdinal(
  db: SetupSessionDb,
  userId: Id<"users">
): Promise<number> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .collect();

  let maxOrdinal = 0;
  for (const session of sessions) {
    if (session.draftOrdinal > maxOrdinal) {
      maxOrdinal = session.draftOrdinal;
    }
  }

  return maxOrdinal + 1;
}
