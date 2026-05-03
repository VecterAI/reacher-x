"use node";

import { v } from "convex/values";
import { internalAction } from "../../lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { requestLinkdApiData } from "./linkdapiClient";
import { requireLinkedInProfileQueryUrn } from "./profileIdentity";

export interface LinkedInProfilePost {
  urn: string;
  url?: string;
  text: string;
  postedAt: number;
  author?: {
    name?: string;
    headline?: string;
    urn?: string;
    url?: string;
    profilePictureURL?: string;
  };
  engagements?: {
    totalReactions?: number;
    commentsCount?: number;
    repostsCount?: number;
  };
  mediaContent?: Array<{
    type?: string;
    url?: string;
  }>;
}

function normalizePost(
  record: Record<string, unknown>
): LinkedInProfilePost | null {
  const text =
    typeof record.text === "string"
      ? record.text.trim()
      : typeof record.comment === "string"
        ? record.comment.trim()
        : "";
  const urn =
    typeof record.urn === "string" && record.urn.trim().length > 0
      ? record.urn.trim()
      : typeof record.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : "";

  if (!urn) {
    return null;
  }

  const postedAt =
    typeof record.postedAt === "object" &&
    record.postedAt &&
    typeof (record.postedAt as Record<string, unknown>).timestamp === "number"
      ? ((record.postedAt as Record<string, unknown>).timestamp as number)
      : typeof record.postedAt === "number"
        ? record.postedAt
        : typeof record.createdAt === "number"
          ? record.createdAt
          : getCurrentUTCTimestamp();

  const authorRecord =
    record.author && typeof record.author === "object"
      ? (record.author as Record<string, unknown>)
      : null;
  const engagementsRecord =
    record.engagements && typeof record.engagements === "object"
      ? (record.engagements as Record<string, unknown>)
      : null;
  const media = Array.isArray(record.mediaContent)
    ? record.mediaContent
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object"
        )
        .map((entry) => ({
          type: typeof entry.type === "string" ? entry.type : undefined,
          url: typeof entry.url === "string" ? entry.url : undefined,
        }))
    : undefined;

  return {
    urn,
    url: typeof record.url === "string" ? record.url : undefined,
    text,
    postedAt,
    author: authorRecord
      ? {
          name:
            typeof authorRecord.name === "string"
              ? authorRecord.name
              : undefined,
          headline:
            typeof authorRecord.headline === "string"
              ? authorRecord.headline
              : undefined,
          urn:
            typeof authorRecord.urn === "string" ? authorRecord.urn : undefined,
          url:
            typeof authorRecord.url === "string" ? authorRecord.url : undefined,
          profilePictureURL:
            typeof authorRecord.profilePictureURL === "string"
              ? authorRecord.profilePictureURL
              : undefined,
        }
      : undefined,
    engagements: engagementsRecord
      ? {
          totalReactions:
            typeof engagementsRecord.totalReactions === "number"
              ? engagementsRecord.totalReactions
              : undefined,
          commentsCount:
            typeof engagementsRecord.commentsCount === "number"
              ? engagementsRecord.commentsCount
              : undefined,
          repostsCount:
            typeof engagementsRecord.repostsCount === "number"
              ? engagementsRecord.repostsCount
              : undefined,
        }
      : undefined,
    mediaContent: media,
  };
}

export const getProfilePostsInternal = internalAction({
  args: {
    urn: v.string(),
    cursor: v.optional(v.string()),
    maxPosts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profileUrn = requireLinkedInProfileQueryUrn(args.urn);
    const data = await requestLinkdApiData<{
      posts?: Array<Record<string, unknown>>;
      cursor?: string | null;
    }>(ctx, {
      path: "/api/v1/posts/all",
      query: args.cursor
        ? { urn: profileUrn, cursor: args.cursor }
        : { urn: profileUrn, start: 0 },
      consumer: `linkedin.getProfilePosts:${profileUrn}:${args.cursor ?? "first"}`,
    });

    const rawPosts = Array.isArray(data.posts) ? data.posts : [];
    const normalizedPosts = rawPosts
      .map((post) => normalizePost(post))
      .filter((post): post is LinkedInProfilePost => post !== null);

    return {
      posts: normalizedPosts.slice(0, args.maxPosts ?? 100),
      nextCursor: typeof data.cursor === "string" ? data.cursor : null,
    };
  },
});
