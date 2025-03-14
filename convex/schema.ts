// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { tweetValidator } from "./validators";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    twitter: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_email", ["email"]),
  threads: defineTable({
    threadId: v.string(),
    createdAt: v.number(),
    tweets: v.array(tweetValidator),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_threadId", ["threadId"]),
});
