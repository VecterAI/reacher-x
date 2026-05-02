import { v } from "convex/values";
import { mutation } from "./lib/functionBuilders";

export const backfillDmAttachmentPreviewUrl = mutation({
  args: {
    prospectId: v.id("prospects"),
    messageId: v.string(),
    previewUrl: v.string(),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) {
      throw new Error("User not found");
    }

    const prospect = await ctx.db.get(args.prospectId);
    if (
      !prospect ||
      prospect.userId !== user._id ||
      prospect.platform !== "twitter"
    ) {
      throw new Error("Prospect not found.");
    }

    const conversation = await ctx.db
      .query("platformConversations")
      .withIndex("by_prospect_platform", (q) =>
        q.eq("prospectId", args.prospectId).eq("platform", "twitter")
      )
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const message = await ctx.db
      .query("platformConversationMessages")
      .withIndex("by_user_conversation_message", (q) =>
        q
          .eq("userId", user._id)
          .eq("conversationId", conversation.conversationId)
          .eq("messageId", args.messageId)
      )
      .first();
    if (!message) {
      throw new Error("Message not found.");
    }

    const attachments =
      message.attachments && message.attachments.length > 0
        ? message.attachments.map((attachment, index) =>
            index === 0
              ? {
                  ...attachment,
                  previewUrl: attachment.previewUrl ?? args.previewUrl,
                  altText: attachment.altText ?? args.altText,
                }
              : attachment
          )
        : [
            {
              type: "image" as const,
              url: args.previewUrl,
              previewUrl: args.previewUrl,
              altText: args.altText,
            },
          ];

    await ctx.db.patch(message._id, {
      attachments,
      updatedAt: Date.now(),
    });

    return {
      success: true as const,
      conversationId: conversation.conversationId,
      messageId: args.messageId,
      attachmentCount: attachments.length,
    };
  },
});
