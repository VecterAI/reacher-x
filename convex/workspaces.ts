import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Creates a default workspace for a user during onboarding
 * Supports migration from localStorage data
 */
export const createDefaultWorkspace = mutation({
  args: {
    description: v.string(),
    name: v.optional(v.string()),
  },
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
      // Update existing default workspace
      await ctx.db.patch(existingDefault._id, {
        description: args.description,
        name: args.name || existingDefault.name,
        updatedAt: Date.now(),
      });
      return existingDefault._id;
    }

    // Create new default workspace
    const now = Date.now();
    return await ctx.db.insert("workspaces", {
      userId: user._id,
      name: args.name || "Default workspace",
      description: args.description,
      isDefault: true,
      updatedAt: now,
    });
  },
});

/**
 * Migrates localStorage data to Convex for a newly authenticated user
 * This should be called when a user first signs up or logs in
 */
export const migrateLocalStorageData = mutation({
  args: {
    workspaceDescription: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
    keywords: v.optional(
      v.array(
        v.object({
          id: v.string(),
          keyword: v.string(),
          exactMatch: v.boolean(),
          createdAt: v.number(),
          lastUsedAt: v.number(),
          searchCount: v.number(),
          isPinned: v.boolean(),
          pinnedAt: v.optional(v.number()),
          source: v.union(
            v.literal("user_created"),
            v.literal("ai_suggestion"),
            v.literal("ai_reprompt")
          ),
          status: v.union(
            v.literal("active"),
            v.literal("high_value"),
            v.literal("discarded")
          ),
          votes: v.array(
            v.object({
              vote: v.union(v.literal("up"), v.literal("down")),
              timestamp: v.number(),
              tweetId: v.optional(v.string()),
            })
          ),
          decayedScore: v.number(),
          metadata: v.optional(v.any()),
        })
      )
    ),
  },
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
      // Update existing workspace with migrated data
      const updateData: {
        updatedAt: number;
        description?: string;
        name?: string;
      } = {
        updatedAt: Date.now(),
      };

      if (args.workspaceDescription) {
        updateData.description = args.workspaceDescription;
      }

      if (args.workspaceName) {
        updateData.name = args.workspaceName;
      }

      await ctx.db.patch(existingDefault._id, updateData);

      // Migrate keywords if provided
      if (args.keywords && args.keywords.length > 0) {
        await ctx.runMutation(
          api.keywordMigration.migrateKeywordsFromLocalStorage,
          {
            keywords: args.keywords,
            workspaceId: existingDefault._id,
          }
        );
      }

      return existingDefault._id;
    }

    // Create new workspace with migrated data
    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      userId: user._id,
      name: args.workspaceName || "Default workspace",
      description: args.workspaceDescription || "",
      isDefault: true,
      updatedAt: now,
    });

    // Migrate keywords if provided
    if (args.keywords && args.keywords.length > 0) {
      await ctx.runMutation(
        api.keywordMigration.migrateKeywordsFromLocalStorage,
        {
          keywords: args.keywords,
          workspaceId,
        }
      );
    }

    return workspaceId;
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
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
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
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updateData.name = args.name;
    }

    if (args.description !== undefined) {
      updateData.description = args.description;
    }

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
  args: {
    workspaceId: v.id("workspaces"),
  },
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
