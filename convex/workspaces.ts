import { mutation, query } from "./_generated/server";
import {
  createDefaultWorkspaceArgsValidator,
  updateWorkspaceArgsValidator,
  getWorkspaceArgsValidator,
} from "./validators";

/**
 * Creates a default workspace for a user during onboarding.
 * This only uses authenticated Convex data; browser localStorage is no longer involved.
 */
export const createDefaultWorkspace = mutation({
  args: createDefaultWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a default workspace
    const existingDefault = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();

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
        updatedAt: Date.now(),
      };
      if (args.descriptionSource)
        updateData.descriptionSource = args.descriptionSource;
      if (args.sourceUrl) updateData.sourceUrl = args.sourceUrl;
      if (args.lastGeneratedAt !== undefined)
        updateData.lastGeneratedAt = args.lastGeneratedAt;

      await ctx.db.patch(existingDefault._id, updateData);
      return existingDefault._id;
    }

    // Create new default workspace
    const now = Date.now();
    return await ctx.db.insert("workspaces", {
      userId: user._id,
      name: args.name || "Default workspace",
      description: args.description,
      descriptionSource: args.descriptionSource,
      sourceUrl: args.sourceUrl,
      lastGeneratedAt: args.lastGeneratedAt,
      isDefault: true,
      updatedAt: now,
    });
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

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      return null;
    }

    // Get the default workspace
    return await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();
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

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      return [];
    }

    // Get all workspaces for the user
    return await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Updates a workspace
 */
export const updateWorkspace = mutation({
  args: updateWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get the workspace and verify ownership
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.userId !== user._id) {
      throw new Error("Not authorized to update this workspace");
    }

    // Update the workspace
    const updateData: {
      updatedAt: number;
      name?: string;
      description?: string;
      descriptionSource?: "manual" | "url";
      sourceUrl?: string;
      lastGeneratedAt?: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updateData.name = args.name;
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
 * Ensures a user has a default workspace, creating one if it doesn't exist
 * This is a robust solution for cases where users authenticate but don't have a workspace
 */
export const ensureDefaultWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a default workspace
    const existingDefault = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();

    if (existingDefault) {
      return existingDefault._id;
    }

    // Create new default workspace
    const now = Date.now();
    return await ctx.db.insert("workspaces", {
      userId: user._id,
      name: "Default workspace",
      description: "",
      isDefault: true,
      updatedAt: now,
    });
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

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      return null;
    }

    // Get the workspace and verify ownership
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      return null;
    }

    return workspace;
  },
});
