import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { PLAN_LIMITS } from "./planConstants";
import { getOrCreateUserPlan } from "./planCore";
import { isTerminalSetupSessionStatus } from "./setupSessionCore";

type EntitlementCtx = QueryCtx | MutationCtx;

type WorkspaceDoc = Doc<"workspaces">;
type SetupSessionDoc = Doc<"workspaceSetupSessions">;
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

async function listUserWorkspacesByCreation(
  ctx: EntitlementCtx,
  userId: Id<"users">
): Promise<WorkspaceDoc[]> {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect()
    .then((workspaces) =>
      [...workspaces].sort((a, b) => a._creationTime - b._creationTime)
    );
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

  const workspaces = await listUserWorkspacesByCreation(ctx, workspace.userId);
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

  const workspaces = await listUserWorkspacesByCreation(ctx, session.userId);
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
    reserved.add(await resolveWorkspaceEntitlementSlot(ctx, workspace));
  }

  for (const session of sessions) {
    if (session._id === options?.excludeSetupSessionId) {
      continue;
    }
    if (isTerminalSetupSessionStatus(session.status)) {
      continue;
    }
    if (session.mode !== "new_workspace") {
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
  }
): Promise<boolean> {
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
