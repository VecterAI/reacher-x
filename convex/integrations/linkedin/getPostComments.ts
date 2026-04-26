"use node";

import { v } from "convex/values";
import { internalAction } from "../../lib/functionBuilders";
import { requestLinkdApiData } from "./linkdapiClient";

type LinkdApiPostCommentResponse = {
  success?: boolean;
  message?: string;
  data?: {
    comments?: Array<Record<string, unknown>>;
    cursor?: string | null;
  };
};

export const getPostComments = internalAction({
  args: {
    urn: v.string(),
    start: v.optional(v.number()),
    count: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payload = await requestLinkdApiData<
      NonNullable<LinkdApiPostCommentResponse["data"]>
    >(ctx, {
      path: "/api/v1/posts/comments",
      query: {
        urn: args.urn,
        start: args.start,
        count: args.count,
        cursor: args.cursor,
      },
      consumer: `linkedin.getPostComments:${args.urn}`,
    });

    return {
      comments: Array.isArray(payload.comments) ? payload.comments : [],
      cursor: typeof payload.cursor === "string" ? payload.cursor : null,
    };
  },
});
