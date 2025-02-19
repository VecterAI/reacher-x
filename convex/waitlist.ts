// convex/waitlist.tsx
import { mutation } from "./_generated/server";
import { v } from "convex/values";

const waitlistEntryValidator = v.object({
  email: v.string(),
  twitter: v.optional(v.string()),
});

export const joinWaitlist = mutation({
  args: waitlistEntryValidator,
  handler: async (ctx, { email, twitter }) => {
    // Query for an existing entry using the email index
    const existingEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingEntry) {
      // Update the Twitter handle (including removing it if undefined)
      await ctx.db.patch(existingEntry._id, { twitter });
    } else {
      // Insert a new entry
      await ctx.db.insert("waitlist", {
        email,
        twitter,
        createdAt: new Date().toISOString(),
      });
    }
  },
});
