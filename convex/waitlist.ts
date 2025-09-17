// convex/waitlist.ts
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { waitlistEntryValidator } from "./validators";

export const joinWaitlist = mutation({
  args: waitlistEntryValidator,
  handler: async (ctx, { email, twitter }) => {
    const existingEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingEntry) {
      // Update the Twitter handle
      await ctx.db.patch(existingEntry._id, { twitter });
    } else {
      // Insert a new entry
      await ctx.db.insert("waitlist", { email, twitter });
      // Schedule the email-sending action immediately
      await ctx.scheduler.runAfter(0, api.sendEmail.sendWelcomeEmail, {
        email,
      });
    }
  },
});

export const getTwitterHandles = query({
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("waitlist")
      .filter((q) => q.neq(q.field("twitter"), undefined))
      .order("desc") // Order by _creationTime descending (newest first)
      .collect();
    return entries.map((entry) => entry.twitter) as string[];
  },
});

export const getWaitlistCount = query({
  handler: async (ctx) => {
    const entries = await ctx.db.query("waitlist").collect();
    return entries.length;
  },
});
