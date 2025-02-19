// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    twitter: v.optional(v.string()),
    // Store the creation time as an ISO string, or use a number/timestamp as needed.
    createdAt: v.string(),
  }),
});
