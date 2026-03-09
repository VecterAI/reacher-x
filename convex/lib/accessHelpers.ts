import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AccessCtx = QueryCtx | MutationCtx;

export type ViewerIdentity = NonNullable<
  Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>
>;

type RequireUserOptions = {
  identity?: ViewerIdentity;
  notFoundMessage?: string;
};

type RequireOwnedResourceOptions = {
  user?: Doc<"users">;
  notFoundMessage?: string;
  notAuthorizedMessage?: string;
};

type RequireDefaultWorkspaceOptions = {
  user?: Doc<"users">;
  notFoundMessage?: string;
};

export type OwnedTaskResult = {
  task: Doc<"outreachTasks">;
  plan: Doc<"outreachPlans">;
};

const DEFAULT_USER_NOT_FOUND_MESSAGE =
  "User not found. Please ensure you are properly authenticated and your user profile has been created.";

export async function getUserByWorkosId(
  ctx: AccessCtx,
  workosUserId: string
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .first();
}

export async function getUserByIdentity(
  ctx: AccessCtx,
  identity: ViewerIdentity
): Promise<Doc<"users"> | null> {
  return getUserByWorkosId(ctx, identity.subject);
}

export async function requireIdentity(ctx: AccessCtx): Promise<ViewerIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

export async function requireUser(
  ctx: AccessCtx,
  options: RequireUserOptions = {}
): Promise<Doc<"users">> {
  const identity = options.identity ?? (await requireIdentity(ctx));
  const user = await getUserByIdentity(ctx, identity);
  if (!user) {
    throw new Error(options.notFoundMessage ?? DEFAULT_USER_NOT_FOUND_MESSAGE);
  }
  return user;
}

export async function getDefaultWorkspaceForUser(
  ctx: AccessCtx,
  userId: Id<"users">
): Promise<Doc<"workspaces"> | null> {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_user_default", (q) =>
      q.eq("userId", userId).eq("isDefault", true)
    )
    .first();
}

export async function requireDefaultWorkspace(
  ctx: AccessCtx,
  options: RequireDefaultWorkspaceOptions = {}
): Promise<Doc<"workspaces">> {
  const user = options.user ?? (await requireUser(ctx));
  const workspace = await getDefaultWorkspaceForUser(ctx, user._id);
  if (!workspace) {
    throw new Error(options.notFoundMessage ?? "Default workspace not found");
  }
  return workspace;
}

export async function getOwnedWorkspace(
  ctx: AccessCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">
): Promise<Doc<"workspaces"> | null> {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace || workspace.userId !== userId) {
    return null;
  }
  return workspace;
}

export async function requireOwnedWorkspace(
  ctx: AccessCtx,
  workspaceId: Id<"workspaces">,
  options: RequireOwnedResourceOptions = {}
): Promise<Doc<"workspaces">> {
  const user = options.user ?? (await requireUser(ctx));
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    throw new Error(options.notFoundMessage ?? "Workspace not found");
  }
  if (workspace.userId !== user._id) {
    throw new Error(
      options.notAuthorizedMessage ?? "Not authorized to access this workspace"
    );
  }
  return workspace;
}

export async function getOwnedProspect(
  ctx: AccessCtx,
  prospectId: Id<"prospects">,
  userId: Id<"users">
): Promise<Doc<"prospects"> | null> {
  const prospect = await ctx.db.get(prospectId);
  if (!prospect || prospect.userId !== userId) {
    return null;
  }
  return prospect;
}

export async function requireOwnedProspect(
  ctx: AccessCtx,
  prospectId: Id<"prospects">,
  options: RequireOwnedResourceOptions = {}
): Promise<Doc<"prospects">> {
  const user = options.user ?? (await requireUser(ctx));
  const prospect = await ctx.db.get(prospectId);
  if (!prospect) {
    throw new Error(options.notFoundMessage ?? "Prospect not found");
  }
  if (prospect.userId !== user._id) {
    throw new Error(
      options.notAuthorizedMessage ?? "Not authorized to access this prospect"
    );
  }
  return prospect;
}

export async function getOwnedPlan(
  ctx: AccessCtx,
  planId: Id<"outreachPlans">,
  userId: Id<"users">
): Promise<Doc<"outreachPlans"> | null> {
  const plan = await ctx.db.get(planId);
  if (!plan || plan.userId !== userId) {
    return null;
  }
  return plan;
}

export async function requireOwnedPlan(
  ctx: AccessCtx,
  planId: Id<"outreachPlans">,
  options: RequireOwnedResourceOptions = {}
): Promise<Doc<"outreachPlans">> {
  const user = options.user ?? (await requireUser(ctx));
  const plan = await ctx.db.get(planId);
  if (!plan) {
    throw new Error(options.notFoundMessage ?? "Outreach plan not found");
  }
  if (plan.userId !== user._id) {
    throw new Error(
      options.notAuthorizedMessage ??
        "Not authorized to access this outreach plan"
    );
  }
  return plan;
}

export async function getOwnedTask(
  ctx: AccessCtx,
  taskId: Id<"outreachTasks">,
  userId: Id<"users">
): Promise<OwnedTaskResult | null> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    return null;
  }

  const plan = await ctx.db.get(task.planId);
  if (!plan || plan.userId !== userId) {
    return null;
  }

  return { task, plan };
}

export async function requireOwnedTask(
  ctx: AccessCtx,
  taskId: Id<"outreachTasks">,
  options: RequireOwnedResourceOptions = {}
): Promise<OwnedTaskResult> {
  const user = options.user ?? (await requireUser(ctx));
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new Error(options.notFoundMessage ?? "Outreach task not found");
  }

  const plan = await ctx.db.get(task.planId);
  if (!plan) {
    throw new Error(options.notFoundMessage ?? "Outreach task not found");
  }
  if (plan.userId !== user._id) {
    throw new Error(
      options.notAuthorizedMessage ??
        "Not authorized to access this outreach task"
    );
  }

  return { task, plan };
}
