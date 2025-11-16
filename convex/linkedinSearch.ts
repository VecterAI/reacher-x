// convex/linkedinSearch.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { buildLinkedInKeyword } from "../shared/lib/utils/linkedinQuery";
import { api } from "./_generated/api";
import { logger } from "../shared/lib/logger";

/**
 * fetchWithRedirectAuth
 * - Follows up to 3 redirects manually.
 * - Preserves Authorization and API-key headers across cross-host redirects.
 * - Only follows redirects that stay within *.linkdapi.com.
 */
async function fetchWithRedirectAuth(
  url: string,
  init: RequestInit
): Promise<Response> {
  const allowHost = /(?:^|\.)linkdapi\.com$/i;
  const maxRedirects = 3;

  let currentUrl = url;
  let res = await fetch(currentUrl, { ...init, redirect: "manual" });

  for (let i = 0; i < maxRedirects; i++) {
    const status = res.status;
    const loc = res.headers.get("location");
    if (
      ![301, 302, 303, 307, 308].includes(status) ||
      !loc ||
      loc.length === 0
    ) {
      break;
    }

    const next = new URL(loc, currentUrl);
    // Only follow redirects inside provider's domain
    if (!allowHost.test(next.hostname)) break;

    currentUrl = next.toString();
    res = await fetch(currentUrl, { ...init, redirect: "manual" });
  }

  return res;
}

function isProxyTunnelError(err: unknown) {
  const msg = String(err || "");
  return (
    /unsuccessful tunnel/i.test(msg) ||
    /ECONNREFUSED|ECONNRESET|EAI_AGAIN|ENOTFOUND|TLS|certificate/i.test(msg)
  );
}

type LinkdApiPost = {
  urn: string;
  postID: string;
  postURL: string;
  text: string;
  author: {
    name: string;
    headline?: string;
    urn?: string;
    id?: string;
    url?: string;
    profilePictureURL?: string;
    type?: string;
  };
  postedAt?: { timestamp?: number; fullDate?: string; relativeDay?: string };
  engagements?: {
    totalReactions?: number;
    commentsCount?: number;
    repostsCount?: number;
  };
  mediaContent?: Array<{ type: "image" | "video" | "article"; url: string }>;
};

type LinkdApiResponse = {
  success: boolean;
  statusCode?: number;
  data?: {
    posts: LinkdApiPost[];
    total?: number;
    start?: number;
    count?: number;
    hasMore?: boolean;
  };
  message?: string;
  errors?: unknown;
};

export const searchLinkedIn = action({
  args: v.object({
    query: v.string(),
    exactMatch: v.boolean(),
    cursor: v.optional(v.number()),
    sortBy: v.optional(
      v.union(v.literal("relevance"), v.literal("date_posted"))
    ),
  }),
  handler: async (ctx, { query, exactMatch, cursor, sortBy }) => {
    const keyword = buildLinkedInKeyword(query, exactMatch);
    logger.info("[LINKEDIN_SEARCH] start", {
      keyword,
      cursor,
      sortBy,
      ts: new Date().toISOString(),
    });

    // Read API key from any of these env vars
    const rawKey =
      process.env.LINKDAPI_KEY ||
      process.env.LINKDAPI_API_KEY ||
      (process.env as Record<string, string | undefined>)["LINKD_API_KEY"] ||
      undefined;
    const apiKey = typeof rawKey === "string" ? rawKey.trim() : undefined;

    // Try linkdapi.com first (often allowed by egress), then api.linkdapi.com.
    const baseUrls = [
      process.env.LINKDAPI_BASE_URL || "https://linkdapi.com",
      "https://api.linkdapi.com",
    ];

    if (!apiKey) {
      return {
        success: false,
        error:
          "LinkedIn API key not configured. Set LINKDAPI_API_KEY in Convex env.",
      };
    }

    // Support both path variants in case the provider changes routing.
    const endpointPaths = ["/api/v1/search/posts", "/v1/search/posts"];

    const authAttempts: Array<
      (headers: Record<string, string>) => Record<string, string>
    > = [
      (h) => ({ ...h, "X-linkdapi-apikey": apiKey }),
      (h) => ({ ...h, Authorization: `Bearer ${apiKey}` }),
    ];

    let lastStatus = 500;
    let lastStatusText = "Unknown error";
    let lastBody = "";
    let okResponse: Response | null = null;

    const effectiveSortBy = sortBy ?? "date_posted";

    for (const baseUrl of baseUrls) {
      for (const path of endpointPaths) {
        const url = new URL(path, baseUrl);
        url.searchParams.set("keyword", keyword);
        if (typeof cursor === "number" && cursor > 0) {
          url.searchParams.set("start", String(cursor));
        }
        url.searchParams.set("sortBy", effectiveSortBy);

        for (const addAuth of authAttempts) {
          try {
            const res = await fetchWithRedirectAuth(url.toString(), {
              method: "GET",
              headers: addAuth({
                Accept: "application/json",
                "Content-Type": "application/json",
              }),
            });

            if (res.ok) {
              okResponse = res;
              break;
            }

            lastStatus = res.status;
            lastStatusText = res.statusText || "";
            try {
              lastBody = await res.text();
            } catch {
              lastBody = "";
            }

            // On explicit auth failures, try the next auth mechanism.
            if (res.status === 401 || res.status === 403) continue;
          } catch (e) {
            if (isProxyTunnelError(e)) {
              lastStatus = 502;
              lastStatusText = "Proxy/Tunnel error";
            } else {
              lastStatus = 500;
              lastStatusText = String(e);
            }
            lastBody = "";
          }
        }
        if (okResponse) break;
      }
      if (okResponse) break;
    }

    if (!okResponse) {
      const snippet =
        typeof lastBody === "string" && lastBody.length > 200
          ? `${lastBody.slice(0, 200)}…`
          : lastBody;
      logger.error("[LINKEDIN_SEARCH] error", {
        status: lastStatus,
        statusText: lastStatusText,
        snippet,
      });
      return {
        success: false,
        error: `LinkdAPI error: ${lastStatus} ${lastStatusText}${
          snippet ? ` – ${snippet}` : ""
        }`,
      };
    }

    const data = (await okResponse.json()) as LinkdApiResponse;
    const posts = data?.data?.posts ?? [];
    const start = data?.data?.start ?? 0;
    const count = data?.data?.count ?? posts.length;
    const hasMore = Boolean(data?.data?.hasMore);
    const nextStart = hasMore ? start + count : undefined;

    const unified = posts.map((p) => {
      return {
        id: p.postID || p.urn || "",
        platform: "linkedin" as const,
        url: p.postURL,
        author: {
          name: p.author?.name,
          headline: p.author?.headline,
          avatarUrl: p.author?.profilePictureURL,
          profileUrl: p.author?.url,
          type: p.author?.type,
        },
        text: p.text || "",
        createdAt: p.postedAt?.timestamp || Date.now(),
        metrics: {
          reactions: p.engagements?.totalReactions ?? 0,
          comments: p.engagements?.commentsCount ?? 0,
          reposts: p.engagements?.repostsCount ?? 0,
        },
        media:
          Array.isArray(p.mediaContent) && p.mediaContent.length > 0
            ? p.mediaContent.map((m) =>
                m.type === "article"
                  ? ({ type: "link", url: m.url } as const)
                  : ({ type: m.type, url: m.url } as const)
              )
            : undefined,
        raw: p,
      };
    });

    logger.info("[LINKEDIN_SEARCH] success", {
      returned: unified.length,
      hasMore,
      nextStart,
    });

    return {
      success: true,
      data: {
        posts: unified,
        has_next_page: hasMore,
        next_cursor: nextStart,
      },
    };
  },
});

/**
 * LinkedIn search + CHUNKED LLM filtering
 * Returns the first filtered chunk immediately and continues chunking on
 * the server.
 */
export const searchLinkedInChunkedFiltered = action({
  args: v.object({
    query: v.string(),
    exactMatch: v.boolean(),
    cursor: v.optional(v.number()),
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    userDescription: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { query, exactMatch, cursor, keywordKey, operation, userDescription }
  ) => {
    logger.info("[LI] chunked start", {
      q: query,
      exactMatch,
      cursor,
      keywordKey,
      op: operation,
      hasDesc: !!userDescription,
    });

    const res = (await ctx.runAction(api.linkedinSearch.searchLinkedIn, {
      query,
      exactMatch,
      cursor,
      sortBy: "date_posted",
    })) as {
      success: boolean;
      data?: {
        posts: Array<{
          id: string;
          platform: "linkedin";
          url?: string;
          author: {
            name?: string;
            headline?: string;
            avatarUrl?: string;
            profileUrl?: string;
          };
          text: string;
          createdAt: number;
          metrics?: {
            reactions?: number;
            comments?: number;
            reposts?: number;
          };
          media?: Array<
            | { type: "image"; url: string; width?: number; height?: number }
            | { type: "video"; url: string }
            | {
                type: "link";
                url: string;
                title?: string;
                description?: string;
              }
          >;
          raw?: unknown;
        }>;
        has_next_page?: boolean;
        next_cursor?: number;
      };
      error?: string;
    };

    if (!res?.success) {
      return { success: false, error: res?.error || "Search failed" };
    }

    const posts = res?.data?.posts || [];
    const hasNext = Boolean(res?.data?.has_next_page);
    const nextCursor = res?.data?.next_cursor;

    logger.info("[LI] chunked fetched page", {
      posts: posts.length,
      hasNext,
      nextCursor,
    });

    const enriched = posts.map((p) => ({
      ...p,
      id_str: p.id,
      user: {
        description: p.author?.headline || "",
        screen_name: "",
        name: p.author?.name || "",
      },
      tweet_created_at: p.createdAt,
    }));

    const chunkSetId = `li_${Date.now()}_${cursor ? "load" : "initial"}`;
    const start = (await ctx.runAction(
      api.llmFilterChunked.startServerChunking,
      {
        keywordKey,
        operation,
        originalQuery: query.trim(),
        userDescription,
        items: { items: enriched },
        chunkSetId,
        pollMs: 3000,
      }
    )) as {
      success: boolean;
      data?: { firstChunkItems: unknown[]; chunkSetId: string };
      error?: string;
    };

    if (!start?.success) {
      return { success: false, error: start?.error || "Filtering failed" };
    }

    const firstChunk = (start.data?.firstChunkItems || []) as typeof enriched;

    logger.info("[LI] chunked first chunk", {
      firstChunk: firstChunk.length,
      chunkSetId,
    });

    return {
      success: true,
      data: {
        posts: firstChunk,
        meta: {
          originalCount: posts.length,
          has_next_page: hasNext,
          next_cursor: nextCursor,
          chunkSetId,
        },
      },
    };
  },
});
