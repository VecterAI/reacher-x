import { mutation } from "./_generated/server";
import { v } from "convex/values";

const waitlistEntryValidator = v.object({
  email: v.string(), // you might add .email() if supported
  twitter: v.optional(v.string()),
});

export const joinWaitlist = mutation({
  args: waitlistEntryValidator,
  handler: async (ctx, { email, twitter }) => {
    await ctx.db.insert("waitlist", {
      email,
      twitter,
      createdAt: new Date().toISOString(),
    });
  },
});
