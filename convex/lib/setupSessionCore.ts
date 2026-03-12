import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { formatWorkspaceDraftName } from "../../shared/lib/workspaceDisplayNames";

type SetupSessionDoc = Doc<"workspaceSetupSessions">;
type SetupSessionDb = QueryCtx["db"] | MutationCtx["db"];

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
):
  | "use_case"
  | "input"
  | "review"
  | "connections"
  | "plan"
  | "preference"
  | "final"
  | "progress" {
  switch (status) {
    case "draft":
      return "use_case";
    case "awaiting_input":
      return "input";
    case "generating":
    case "awaiting_review":
      return "review";
    case "awaiting_connections":
      return "connections";
    case "awaiting_plan":
      return "plan";
    case "awaiting_preferences":
      return "preference";
    case "awaiting_final_confirmation":
      return "final";
    case "provisioning_workspace":
    case "running_initial_discovery":
    case "waiting_for_first_ready_profile":
    case "ready":
      return "progress";
    case "failed":
    case "discarded":
      return "input";
    default:
      return "input";
  }
}

export async function getActiveSetupSessionForUser(
  db: SetupSessionDb,
  userId: Id<"users">
): Promise<SetupSessionDoc | null> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  return (
    sessions.find((session) => !isTerminalSetupSessionStatus(session.status)) ??
    null
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
  return await db
    .query("workspaceSetupSessions")
    .withIndex("by_target_workspace", (q) =>
      q.eq("targetWorkspaceId", targetWorkspaceId)
    )
    .first();
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
