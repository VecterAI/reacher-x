"use node";

import { v } from "convex/values";
import { internalAction } from "../../lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { getLinkedInActivityTimestamp } from "../../../shared/lib/linkedin/post";
import { isLinkdApiNoDataError, requestLinkdApiData } from "./linkdapiClient";
import { requireLinkedInProfileQueryUrn } from "./profileIdentity";
import {
  buildLinkdApiProfilePostsQuery,
  limitLinkdApiProfilePosts,
} from "../../lib/linkdApiProfilePostsCore";

export interface LinkedInProfilePost {
  urn: string;
  url?: string;
  header?: string;
  text: string;
  postedAt: number;
  author?: {
    name?: string;
    headline?: string;
    urn?: string;
    url?: string;
    profilePictureURL?: string;
    type?: string;
  };
  textAttributes?: Array<{
    length?: number;
    text: string;
    type: string;
    urn?: string;
    url?: string;
  }>;
  engagements?: {
    totalReactions?: number;
    commentsCount?: number;
    repostsCount?: number;
  };
  mediaContent?: Array<{
    type?: string;
    url?: string;
  }>;
  resharedPostContent?: LinkedInProfilePost;
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

  const providerPostedAt =
    typeof record.postedAt === "object" &&
    record.postedAt &&
    typeof (record.postedAt as Record<string, unknown>).timestamp === "number"
      ? ((record.postedAt as Record<string, unknown>).timestamp as number)
      : typeof record.postedAt === "number"
        ? record.postedAt
        : typeof record.createdAt === "number"
          ? record.createdAt
          : undefined;
  const postedAt =
    providerPostedAt && providerPostedAt > 0
      ? providerPostedAt
      : (getLinkedInActivityTimestamp(urn) ?? getCurrentUTCTimestamp());

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
  const textAttributes = Array.isArray(record.textAttributes)
    ? record.textAttributes.flatMap((attribute) => {
        if (!attribute || typeof attribute !== "object") {
          return [];
        }
        const value = attribute as Record<string, unknown>;
        if (typeof value.text !== "string" || typeof value.type !== "string") {
          return [];
        }
        return [
          {
            length: typeof value.length === "number" ? value.length : undefined,
            text: value.text,
            type: value.type,
            urn: typeof value.urn === "string" ? value.urn : undefined,
            url: typeof value.url === "string" ? value.url : undefined,
          },
        ];
      })
    : undefined;
  const resharedPostContent =
    record.resharedPostContent &&
    typeof record.resharedPostContent === "object" &&
    !Array.isArray(record.resharedPostContent)
      ? normalizePost(record.resharedPostContent as Record<string, unknown>)
      : null;

  return {
    urn,
    url: typeof record.url === "string" ? record.url : undefined,
    header: typeof record.header === "string" ? record.header : undefined,
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
          type:
            typeof authorRecord.type === "string"
              ? authorRecord.type
              : undefined,
        }
      : undefined,
    textAttributes,
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
    resharedPostContent: resharedPostContent ?? undefined,
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
    let data: {
      posts?: Array<Record<string, unknown>>;
      cursor?: string | null;
    };
    try {
      data = await requestLinkdApiData(ctx, {
        path: "/api/v1/posts/all",
        query: buildLinkdApiProfilePostsQuery(profileUrn, args.cursor),
        consumer: `linkedin.getProfilePosts:${profileUrn}:${args.cursor ?? "first"}`,
      });
    } catch (error) {
      if (isLinkdApiNoDataError(error)) {
        return {
          posts: [],
          nextCursor: null,
          unavailableReason: "profile_data_unavailable" as const,
        };
      }
      throw error;
    }

    const rawPosts = Array.isArray(data.posts) ? data.posts : [];
    const normalizedPosts = rawPosts
      .map((post) => normalizePost(post))
      .filter((post): post is LinkedInProfilePost => post !== null);

    return {
      posts: limitLinkdApiProfilePosts(normalizedPosts, args.maxPosts),
      nextCursor: typeof data.cursor === "string" ? data.cursor : null,
    };
  },
});
