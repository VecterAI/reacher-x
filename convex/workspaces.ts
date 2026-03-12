import { v } from "convex/values";
import {
  createDefaultWorkspaceArgsValidator,
  updateWorkspaceArgsValidator,
  getWorkspaceArgsValidator,
  setDefaultWorkspaceArgsValidator,
  workspaceUseCaseKeyValidator,
  workspaceOnboardingIssueSourceValidator,
  workspaceOnboardingIssueStatusCodeValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import {
  getDefaultWorkspaceForUser,
  getOwnedWorkspace,
  getUserByIdentity,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import { assertValidWorkspaceName } from "./lib/workspaceNameHelpers";
import { hasRequiredWorkspaceAgentData } from "./lib/workspaceSetup";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  resolveWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "../shared/lib/workspaceUseCases";

type WorkspaceDoc = Doc<"workspaces">;
type WorkspaceWithResolvedUseCase = Omit<WorkspaceDoc, "useCaseKey"> & {
  useCaseKey: WorkspaceUseCaseKey;
};

function withResolvedWorkspaceUseCase(
  workspace: WorkspaceDoc
): WorkspaceWithResolvedUseCase {
  return {
    ...workspace,
    useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
  };
}

// ============================================================================
// Workspace Setup Status Query (for frontend)
// ============================================================================

/**
 * Gets the workspace setup status for the agent UI.
 * Used to determine which conversation flow to show.
 */
export const getWorkspaceSetupStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { status: "unauthenticated" as const };
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return { status: "no_user" as const };
    }

    const workspace = await getDefaultWorkspaceForUser(ctx, user._id);
    if (!workspace) {
      return { status: "no_workspace" as const };
    }

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);

    if (!hasRequiredSetupData) {
      return {
        status: "needs_icp" as const,
        workspace: {
          id: workspace._id,
          name: workspace.name,
          description: workspace.description,
          hasDescription: (workspace.description ?? "").length > 0,
          useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
        },
      };
    }

    return {
      status: "complete" as const,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        description: workspace.description,
        useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
      },
    };
  },
});

/**
 * Legacy mutation that can only update an existing default workspace draft.
 * New workspaces must be created via the approved setup flow.
 */
export const createDefaultWorkspace = mutation({
  args: createDefaultWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const existingDefault = await getDefaultWorkspaceForUser(ctx, user._id);

    if (existingDefault) {
      // Update existing default workspace (do not overwrite name here)
      const updateData: {
        description: string;
        updatedAt: number;
        descriptionSource?: "manual" | "url";
        sourceUrl?: string;
        lastGeneratedAt?: number;
      } = {
        description: args.description,
        updatedAt: getCurrentUTCTimestamp(),
      };
      if (args.descriptionSource)
        updateData.descriptionSource = args.descriptionSource;
      if (args.sourceUrl) updateData.sourceUrl = args.sourceUrl;
      if (args.lastGeneratedAt !== undefined)
        updateData.lastGeneratedAt = args.lastGeneratedAt;

      await ctx.db.patch(existingDefault._id, updateData);
      return existingDefault._id;
    }

    throw new Error(
      "Workspace setup must be completed in the setup flow before a workspace can be created"
    );
  },
});

/**
 * Gets the current user's default workspace
 */
export const getDefaultWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }

    const workspace = await getDefaultWorkspaceForUser(ctx, user._id);
    return workspace ? withResolvedWorkspaceUseCase(workspace) : null;
  },
});

/**
 * Gets all workspaces for the current user
 */
export const getUserWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return [];
    }

    // Get all workspaces for the user
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return workspaces.map(withResolvedWorkspaceUseCase);
  },
});

/**
 * Updates a workspace
 */
export const updateWorkspace = mutation({
  args: updateWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    // Update the workspace
    const updateData: {
      updatedAt: number;
      name?: string;
      description?: string;
      descriptionSource?: "manual" | "url";
      sourceUrl?: string;
      lastGeneratedAt?: number;
    } = {
      updatedAt: getCurrentUTCTimestamp(),
    };

    if (args.name !== undefined) {
      updateData.name = assertValidWorkspaceName(args.name);
    }

    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.descriptionSource !== undefined)
      updateData.descriptionSource = args.descriptionSource;
    if (args.sourceUrl !== undefined) updateData.sourceUrl = args.sourceUrl;
    if (args.lastGeneratedAt !== undefined)
      updateData.lastGeneratedAt = args.lastGeneratedAt;

    await ctx.db.patch(args.workspaceId, updateData);
    return args.workspaceId;
  },
});

/**
 * Sets the selected workspace as default for the current user.
 * This drives active workspace context across the web app.
 */
export const setDefaultWorkspace = mutation({
  args: setDefaultWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const targetWorkspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    if (targetWorkspace.isDefault) {
      return { workspaceId: targetWorkspace._id, switched: false };
    }

    const now = getCurrentUTCTimestamp();
    const currentDefaults = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .collect();

    for (const workspace of currentDefaults) {
      if (workspace._id !== targetWorkspace._id) {
        await ctx.db.patch(workspace._id, {
          isDefault: false,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(targetWorkspace._id, {
      isDefault: true,
      updatedAt: now,
    });

    return { workspaceId: targetWorkspace._id, switched: true };
  },
});

/**
 * Ensures a user has a default workspace assignment without creating a new one.
 * This is only for recovering users with existing workspaces but no default flag.
 */
export const ensureDefaultWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const existingDefault = await getDefaultWorkspaceForUser(ctx, user._id);

    if (existingDefault) {
      return existingDefault._id;
    }

    // If user has workspaces but none marked default, recover by promoting one.
    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (existingWorkspace) {
      await ctx.db.patch(existingWorkspace._id, {
        isDefault: true,
        updatedAt: getCurrentUTCTimestamp(),
      });
      return existingWorkspace._id;
    }

    return null;
  },
});

/**
 * One-time, idempotent rollout backfill for legacy workspaces created before
 * `useCaseKey` was persisted. Existing rows keep their current template.
 */
export const backfillWorkspaceUseCases = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    let updated = 0;
    let alreadyPersisted = 0;

    for (const workspace of workspaces) {
      if (workspace.useCaseKey !== undefined) {
        alreadyPersisted += 1;
        continue;
      }

      await ctx.db.patch(workspace._id, {
        useCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY,
        updatedAt: getCurrentUTCTimestamp(),
      });
      updated += 1;
    }

    return {
      scanned: workspaces.length,
      updated,
      alreadyPersisted,
      persistedUseCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY,
    };
  },
});

/**
 * Gets a specific workspace by ID
 */
export const getWorkspace = query({
  args: getWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    return workspace ? withResolvedWorkspaceUseCase(workspace) : null;
  },
});

// ============================================================================
// Agent-specific mutations (Internal - no auth check)
// ============================================================================

import { icpValidator } from "./validators";

/**
 * Internal query to get workspace by ID (for agent actions).
 * No auth check - used by trusted server-side code.
 */
export const getById = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace ? withResolvedWorkspaceUseCase(workspace) : null;
  },
});

/**
 * Internal query to get default workspace by user ID (for createWorkspace tool).
 * Used to check if we should update existing or create new.
 */
export const getDefaultWorkspaceByUserId = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", args.userId).eq("isDefault", true)
      )
      .first();
    return workspace ? withResolvedWorkspaceUseCase(workspace) : null;
  },
});

/**
 * Internal query to get workspace by ID (alias for socialapiMonitors).
 * Returns workspace with userId for creating monitors.
 */
export const getWorkspaceInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace ? withResolvedWorkspaceUseCase(workspace) : null;
  },
});

/**
 * Internal query to get default workspace for a user.
 * Used by getUserStatus tool.
 */
export const getDefaultWorkspaceInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", args.userId).eq("isDefault", true)
      )
      .first();
    return workspace ? withResolvedWorkspaceUseCase(workspace) : null;
  },
});

/**
 * Persist an internal onboarding issue state on a workspace.
 * This is used for reliable, user-safe issue messaging.
 */
export const setOnboardingIssueStateInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    statusCode: workspaceOnboardingIssueStatusCodeValidator,
    source: workspaceOnboardingIssueSourceValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      onboardingIssueStatusCode: args.statusCode,
      onboardingIssueSource: args.source,
      onboardingIssueUpdatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Clear internal onboarding issue state once setup recovers.
 */
export const clearOnboardingIssueStateInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      onboardingIssueStatusCode: undefined,
      onboardingIssueSource: undefined,
      onboardingIssueUpdatedAt: undefined,
    });
  },
});

/**
 * Persist setup thread linkage for a workspace so onboarding can restore context.
 */
export const setOnboardingThreadInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      onboardingThreadId: args.threadId,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Internal mutation to create a workspace with v4 fields.
 * Used by createWorkspace tool.
 */
export const createWorkspaceInternal = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    seedDescription: v.string(),
    improvedDescription: v.string(),
    icps: v.array(icpValidator),
    sourceUrl: v.optional(v.string()),
    descriptionSource: v.union(v.literal("url"), v.literal("manual")),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const normalizedName = assertValidWorkspaceName(args.name);

    const eligibility = await ctx.runQuery(
      internal.plans.getWorkspaceCreationEligibilityByUserId,
      {
        userId: args.userId,
      }
    );
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason ?? "Workspace limit reached");
    }

    const now = getCurrentUTCTimestamp();

    // If setting as default, unset any existing default
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", args.userId).eq("isDefault", true)
        )
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { isDefault: false });
      }
    }

    // Create new workspace with v4 fields
    const workspaceId = await ctx.db.insert("workspaces", {
      userId: args.userId,
      name: normalizedName,
      description: args.description,
      seedDescription: args.seedDescription,
      improvedDescription: args.improvedDescription,
      icps: args.icps,
      descriptionSource: args.descriptionSource,
      sourceUrl: args.sourceUrl,
      useCaseKey: args.useCaseKey,
      lastGeneratedAt: now,
      setupCompletedAt: now,
      isDefault: args.isDefault,
      updatedAt: now,
    });

    return workspaceId;
  },
});

/**
 * Internal mutation to update a workspace with v4 fields.
 * Used by updateWorkspace tool.
 */
export const updateWorkspaceInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    seedDescription: v.optional(v.string()),
    improvedDescription: v.string(),
    description: v.string(),
    icps: v.array(icpValidator),
    sourceUrl: v.optional(v.string()),
    descriptionSource: v.optional(
      v.union(v.literal("url"), v.literal("manual"), v.literal("agent"))
    ),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
    setupCompletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();

    const updateData: Record<string, unknown> = {
      description: args.description,
      improvedDescription: args.improvedDescription,
      icps: args.icps,
      lastGeneratedAt: now,
      updatedAt: now,
    };

    if (args.seedDescription !== undefined) {
      updateData.seedDescription = args.seedDescription;
    }
    if (args.sourceUrl !== undefined) {
      updateData.sourceUrl = args.sourceUrl;
    }
    if (args.descriptionSource !== undefined) {
      updateData.descriptionSource = args.descriptionSource;
    }
    if (args.useCaseKey !== undefined) {
      updateData.useCaseKey = args.useCaseKey;
    }
    if (args.setupCompletedAt !== undefined) {
      updateData.setupCompletedAt = args.setupCompletedAt;
    }

    await ctx.db.patch(args.workspaceId, updateData);
  },
});

// ============================================================================
// Prospecting Workflow Management
// ============================================================================

import { workflow } from "./lib/workflow";

/**
 * Start the continuous prospecting workflow for a workspace.
 * Called automatically after workspace setup or manually by user.
 */
export const startProspectingWorkflow = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; error?: string; workflowId?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
    if (!hasRequiredSetupData) {
      throw new Error("Workspace setup is incomplete");
    }

    // Check if workflow is already running
    if (workspace.prospectingWorkflowStatus === "running") {
      return {
        success: false,
        error: "Workflow is already running",
        workflowId: workspace.prospectingWorkflowId ?? undefined,
      };
    }

    // Start the workflow with onComplete handler for continuous operation
    const workflowId = await workflow.start(
      ctx,
      internal.workflows.prospecting.prospectingWorkflow,
      { workspaceId: args.workspaceId },
      {
        onComplete: internal.workflows.prospecting.handleWorkflowComplete,
        context: { workspaceId: args.workspaceId },
      }
    );

    // Update workspace with workflow ID and status
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "running",
      workflowId: workflowId.toString(),
    });

    return {
      success: true,
      workflowId: workflowId.toString(),
    };
  },
});

/**
 * Internal action to start workflow (for use by agent tools).
 */
export const startProspectingWorkflowInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; error?: string; workflowId?: string }> => {
    // Get workspace to verify it exists and is ready
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
    if (!hasRequiredSetupData) {
      throw new Error("Workspace setup is incomplete");
    }

    // Check if workflow is already running
    if (workspace.prospectingWorkflowStatus === "running") {
      return {
        success: false,
        error: "Workflow is already running",
        workflowId: workspace.prospectingWorkflowId ?? undefined,
      };
    }

    // Start the workflow with onComplete handler for continuous operation
    const workflowId = await workflow.start(
      ctx,
      internal.workflows.prospecting.prospectingWorkflow,
      { workspaceId: args.workspaceId },
      {
        onComplete: internal.workflows.prospecting.handleWorkflowComplete,
        context: { workspaceId: args.workspaceId },
      }
    );

    // Update workspace with workflow ID and status
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "running",
      workflowId: workflowId.toString(),
    });

    return {
      success: true,
      workflowId: workflowId.toString(),
    };
  },
});

/**
 * Stop the continuous prospecting workflow for a workspace.
 */
export const stopProspectingWorkflow = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    if (!workspace.prospectingWorkflowId) {
      return {
        success: false,
        error: "No active workflow found",
      };
    }

    // Cancel the workflow
    try {
      await workflow.cancel(ctx, workspace.prospectingWorkflowId as any);
    } catch (err) {
      console.error("Failed to cancel workflow:", err);
      // Continue to update status even if cancel fails
    }

    // Update workspace status
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "stopped",
    });

    return {
      success: true,
    };
  },
});

/**
 * Get the prospecting workflow status for a workspace.
 */
export const getProspectingWorkflowStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) {
      return null;
    }

    return {
      workflowId: workspace.prospectingWorkflowId,
      status: workspace.prospectingWorkflowStatus || "stopped",
      startedAt: workspace.prospectingWorkflowStartedAt,
    };
  },
});
