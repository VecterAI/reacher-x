"use node";

import { v } from "convex/values";
import { internalAction } from "../../lib/functionBuilders";

type LinkdApiPostCommentResponse = {
  success?: boolean;
  message?: string;
  data?: {
    comments?: Array<Record<string, unknown>>;
    cursor?: string | null;
  };
};

function getApiKey(): string | null {
  return process.env.LINKDAPI_API_KEY ?? null;
}

export const getPostComments = internalAction({
  args: {
    urn: v.string(),
    start: v.optional(v.number()),
    count: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (_, args) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("LINKDAPI_API_KEY environment variable not set");
    }

    const params = new URLSearchParams();
    params.set("urn", args.urn);
    if (typeof args.start === "number") {
      params.set("start", String(args.start));
    }
    if (typeof args.count === "number") {
      params.set("count", String(args.count));
    }
    if (args.cursor) {
      params.set("cursor", args.cursor);
    }

    const response = await fetch(
      `https://linkdapi.com/api/v1/posts/comments?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "X-linkdapi-apikey": apiKey,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `LinkdAPI post comments request failed with ${response.status}`
      );
    }

    const payload = (await response.json()) as LinkdApiPostCommentResponse;
    if (payload?.success === false) {
      throw new Error(payload.message || "Failed to fetch LinkdAPI comments");
    }

    return {
      comments: Array.isArray(payload?.data?.comments) ? payload.data.comments : [],
      cursor:
        typeof payload?.data?.cursor === "string" ? payload.data.cursor : null,
    };
  },
});
