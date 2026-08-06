import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isPaidPlanTier, PLAN_LIMITS } from "./planConstants";
import { getOrCreateUserPlan } from "./planCore";
import { isTerminalSetupSessionStatus } from "./setupSessionCore";
import { isWorkspaceSetupCompleted } from "./workspaceSetup";

type EntitlementCtx = QueryCtx | MutationCtx;

type WorkspaceDoc = Doc<"workspaces">;
type SetupSessionDoc = Doc<"workspaceSetupSessions">;
type UnpaidFirstWorkspacePreviewSession = Pick<
  SetupSessionDoc,
  | "_id"
  | "userId"
  | "mode"
  | "status"
  | "entitlementSlot"
  | "targetWorkspaceId"
  | "existingWorkspaceId"
>;
type ReservedEntitlementOptions = {
  consumeEntitlementSlot?: number;
  excludeSetupSessionId?: Id<"workspaceSetupSessions">;
};

export function getWorkspaceSlotLimitForTier(
  tier: keyof typeof PLAN_LIMITS
): number {
  return PLAN_LIMITS[tier].workspacesLimit;
}

export function isEntitlementSlotAccessible(args: {
  entitlementSlot: number | null | undefined;
  tier: keyof typeof PLAN_LIMITS;
}): boolean {
  if (!isPaidPlanTier(args.tier)) {
    return true;
  }

  const slot = args.entitlementSlot ?? 1;
  return slot <= getWorkspaceSlotLimitForTier(args.tier);
}

export async function getCurrentWorkspaceSlotLimit(
  ctx: EntitlementCtx,
  userId: Id<"users">
): Promise<number> {
  const plan = await getOrCreateUserPlan(ctx, userId);
  return getWorkspaceSlotLimitForTier(plan.tier);
}

export function doesWorkspaceReserveEntitlementSlot(
  workspace: Pick<WorkspaceDoc, "setupCompletedAt">
): boolean {
  return isWorkspaceSetupCompleted(workspace);
}

export function doesSetupSessionReserveEntitlementSlot(
  session: Pick<SetupSessionDoc, "mode" | "status">
): boolean {
  return (
    session.mode === "new_workspace" &&
    !isTerminalSetupSessionStatus(session.status)
  );
}

/**
 * Authorize the single provisional workspace needed to show an unpaid user
 * their onboarding preview. This does not authorize normal workspace creation:
 * the caller must provide the exact first-workspace setup session and slot that
 * are currently being provisioned.
 */
export function canProvisionUnpaidFirstWorkspacePreview(args: {
  session: UnpaidFirstWorkspacePreviewSession | null;
  userId: Id<"users">;
  setupSessionId: Id<"workspaceSetupSessions"> | undefined;
  entitlementSlot: number | undefined;
}): boolean {
  const { session } = args;

  return Boolean(
    session &&
    args.setupSessionId &&
    session._id === args.setupSessionId &&
    session.userId === args.userId &&
    session.mode === "first_workspace" &&
    session.status === "provisioning_preview_workspace" &&
    typeof args.entitlementSlot === "number" &&
    session.entitlementSlot === args.entitlementSlot &&
    !session.targetWorkspaceId &&
    !session.existingWorkspaceId
  );
}

async function listUserWorkspacesByCreation(
  ctx: EntitlementCtx,
  userId: Id<"users">
): Promise<WorkspaceDoc[]> {
  const workspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  return workspaces
    .filter((workspace) => !workspace.deletionWorkflowId)
    .sort((a, b) => a._creationTime - b._creationTime);
}

async function listUserSetupSessionsByCreation(
  ctx: EntitlementCtx,
  userId: Id<"users">
): Promise<SetupSessionDoc[]> {
  return await ctx.db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .collect()
    .then((sessions) =>
      [...sessions].sort((a, b) => a._creationTime - b._creationTime)
    );
}

export async function resolveWorkspaceEntitlementSlot(
  ctx: EntitlementCtx,
  workspace: Pick<WorkspaceDoc, "_id" | "userId" | "_creationTime"> & {
    entitlementSlot?: number;
  }
): Promise<number> {
  if (typeof workspace.entitlementSlot === "number") {
    return workspace.entitlementSlot;
  }

  const workspaces = (
    await listUserWorkspacesByCreation(ctx, workspace.userId)
  ).filter(doesWorkspaceReserveEntitlementSlot);
  const fallbackIndex = workspaces.findIndex(
    (item) => item._id === workspace._id
  );
  return fallbackIndex >= 0 ? fallbackIndex + 1 : 1;
}

export async function resolveSetupSessionEntitlementSlot(
  ctx: EntitlementCtx,
  session: Pick<
    SetupSessionDoc,
    | "_id"
    | "userId"
    | "_creationTime"
    | "entitlementSlot"
    | "targetWorkspaceId"
    | "existingWorkspaceId"
    | "mode"
    | "status"
  >
): Promise<number> {
  if (typeof session.entitlementSlot === "number") {
    return session.entitlementSlot;
  }

  const linkedWorkspaceId =
    session.targetWorkspaceId ?? session.existingWorkspaceId ?? null;
  if (linkedWorkspaceId) {
    const workspace = await ctx.db.get(linkedWorkspaceId);
    if (workspace) {
      return await resolveWorkspaceEntitlementSlot(ctx, workspace);
    }
  }

  const workspaces = (
    await listUserWorkspacesByCreation(ctx, session.userId)
  ).filter(doesWorkspaceReserveEntitlementSlot);
  const sessions = await listUserSetupSessionsByCreation(ctx, session.userId);
  const newWorkspaceDrafts = sessions.filter(
    (candidate) =>
      candidate.mode === "new_workspace" &&
      !isTerminalSetupSessionStatus(candidate.status) &&
      !candidate.targetWorkspaceId &&
      !candidate.existingWorkspaceId
  );
  const fallbackIndex = newWorkspaceDrafts.findIndex(
    (candidate) => candidate._id === session._id
  );

  return workspaces.length + (fallbackIndex >= 0 ? fallbackIndex + 1 : 1);
}

export async function getReservedEntitlementSlots(
  ctx: EntitlementCtx,
  userId: Id<"users">,
  options?: ReservedEntitlementOptions
): Promise<Set<number>> {
  const [workspaces, sessions] = await Promise.all([
    listUserWorkspacesByCreation(ctx, userId),
    listUserSetupSessionsByCreation(ctx, userId),
  ]);
  const reserved = new Set<number>();

  for (const workspace of workspaces) {
    if (!doesWorkspaceReserveEntitlementSlot(workspace)) {
      continue;
    }
    reserved.add(await resolveWorkspaceEntitlementSlot(ctx, workspace));
  }

  for (const session of sessions) {
    if (session._id === options?.excludeSetupSessionId) {
      continue;
    }
    if (!doesSetupSessionReserveEntitlementSlot(session)) {
      continue;
    }
    reserved.add(await resolveSetupSessionEntitlementSlot(ctx, session));
  }

  if (typeof options?.consumeEntitlementSlot === "number") {
    reserved.delete(options.consumeEntitlementSlot);
  }

  return reserved;
}

export async function resolveNextEntitlementSlotForUser(
  ctx: EntitlementCtx,
  userId: Id<"users">
): Promise<number> {
  const reserved = await getReservedEntitlementSlots(ctx, userId);
  let slot = 1;
  while (reserved.has(slot)) {
    slot += 1;
  }
  return slot;
}

export async function isWorkspaceAccessibleForUser(
  ctx: EntitlementCtx,
  workspace: Pick<WorkspaceDoc, "_id" | "userId" | "_creationTime"> & {
    entitlementSlot?: number;
    deletionWorkflowId?: string;
  }
): Promise<boolean> {
  if (workspace.deletionWorkflowId) {
    return false;
  }
  const plan = await getOrCreateUserPlan(ctx, workspace.userId);
  const entitlementSlot = await resolveWorkspaceEntitlementSlot(ctx, workspace);
  return isEntitlementSlotAccessible({
    entitlementSlot,
    tier: plan.tier,
  });
}

export async function isSetupSessionAccessibleForUser(
  ctx: EntitlementCtx,
  session: Pick<
    SetupSessionDoc,
    | "_id"
    | "userId"
    | "_creationTime"
    | "entitlementSlot"
    | "targetWorkspaceId"
    | "existingWorkspaceId"
    | "mode"
    | "status"
  >
): Promise<boolean> {
  const plan = await getOrCreateUserPlan(ctx, session.userId);
  const entitlementSlot = await resolveSetupSessionEntitlementSlot(
    ctx,
    session
  );
  return isEntitlementSlotAccessible({
    entitlementSlot,
    tier: plan.tier,
  });
}

export async function getFirstAccessibleWorkspaceForUser(
  ctx: EntitlementCtx,
  userId: Id<"users">
): Promise<WorkspaceDoc | null> {
  const workspaces = await listUserWorkspacesByCreation(ctx, userId);

  for (const workspace of workspaces) {
    if (await isWorkspaceAccessibleForUser(ctx, workspace)) {
      return workspace;
    }
  }

  return null;
}
