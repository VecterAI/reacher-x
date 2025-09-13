// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { tweetValidator } from "./validators";

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    lastSyncedAt: v.optional(v.number()),
  }).index("by_workos_user_id", ["workosUserId"]),

  socialAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  }).index("by_user_provider", ["userId", "provider"]),

  waitlist: defineTable({
    email: v.string(),
    twitter: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_email", ["email"]),

  threads: defineTable({
    threadId: v.string(),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
    tweets: v.array(tweetValidator),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_threadId", ["threadId"])
    .index("by_userId", ["userId"]),

  eventCursors: defineTable({
    type: v.string(),
    cursor: v.string(),
    updatedAt: v.number(),
  }).index("by_type", ["type"]),

  userDeletionEvents: defineTable({
    workosUserId: v.string(),
    deletedAt: v.number(),
    socialAccountsDeleted: v.number(),
    threadsDeleted: v.number(),
  }).index("by_workos_user_id", ["workosUserId"]),
});
