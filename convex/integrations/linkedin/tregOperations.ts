"use node";

import type { ActionCtx } from "../../_generated/server";
import type { LinkdApiPurpose } from "../../lib/benchmarkLinkdApiCap";
import type { LinkedInCompany } from "./getCompany";
import type { LinkedInContactInfo, LinkedInProfile } from "./getProfile";
import type { LinkedInProfilePost } from "./getProfilePosts";
import type { LinkedInPerson } from "./searchPeople";
import type { LinkedInPost } from "./searchPosts";
import { requestTregWithFallback, type TregCallAttempt } from "./tregClient";
import {
  filterLinkedInPostsByKeyword,
  mapDatePostedToAnyApi,
  mapDatePostedToHarvestLimit,
  mapSortByToHarvest,
  normalizeTregCompany,
  normalizeTregContactEnrichment,
  normalizeTregGeoLookup,
  normalizeTregPeopleSearchPage,
  normalizeTregPostCommentsPage,
  normalizeTregProfilePostsPage,
  normalizeTregSearchPostsPage,
  normalizeTregUserProfile,
  toLinkedInSearchPostFromProfilePost,
  type TregProfileSupplemental,
} from "./tregNormalizers";

function isRawProfileUrnId(value: string): boolean {
  return /^ACoA/i.test(value) || value.startsWith("urn:li:");
}

function toLinkedInProfileUrl(identifier: string): string {
  if (/^https?:\/\//i.test(identifier)) return identifier;
  const clean = identifier.replace(/^urn:li:fsd_profile:/i, "").trim();
  return `https://www.linkedin.com/in/${clean}`;
}

function toLinkedInPostUrn(urnOrId: string): string {
  const trimmed = urnOrId.trim();
  if (trimmed.startsWith("urn:li:") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `urn:li:activity:${trimmed}`;
  }
  return trimmed;
}

/** Resolve a location string into a LinkedIn numeric geoId via treg.to (free). */
export async function lookupTregLinkedInGeoId(
  ctx: ActionCtx,
  location: string
): Promise<string | undefined> {
  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.searchPeople.geoLookup:${location}`,
    attempts: [
      {
        toolId: "harvestapi.linkedin.geo.search",
        method: "GET",
        query: { search: location },
        parse: normalizeTregGeoLookup,
      },
    ],
  });
  return result.data;
}

/** Search LinkedIn people via treg.people.search with harvestapi fallback. */
export async function searchTregLinkedInPeoplePage(
  ctx: ActionCtx,
  args: {
    query: string;
    searchMode: "title" | "keyword";
    geoUrn?: string;
    location?: string;
    start: number;
    count: number;
    cursor?: string;
  }
): Promise<{
  people: LinkedInPerson[];
  total: number;
  start: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const limit = Math.min(Math.max(args.count, 10), 25);
  const page = Math.max(
    1,
    Math.floor(args.start / Math.max(args.count, 1)) + 1
  );
  const attempts: TregCallAttempt<{
    people: LinkedInPerson[];
    total: number;
    start: number;
    hasMore: boolean;
    nextCursor: string | null;
  }>[] = [];

  if (args.searchMode === "title" && !args.location) {
    attempts.push({
      toolId: "treg.people.search",
      method: "POST",
      body: {
        title: args.query,
        limit,
        ...(args.cursor ? { cursor: args.cursor } : {}),
      },
      headers: {
        "X-Treg-Route-Prefer": "quickenrich,blitzapi",
        "X-Treg-Route-Max-Cost": "0.05",
      },
      parse: (raw) =>
        normalizeTregPeopleSearchPage(raw, { start: args.start, count: limit }),
      isEmpty: (parsed) => parsed.people.length === 0,
    });
  } else if (!args.cursor) {
    // Semantic people search (exa) honors city/region location text in `q` and
    // does not paginate with cursors, so only run it on page 1.
    const semanticQuery = args.location
      ? `${args.query} in ${args.location}`
      : args.query;
    attempts.push({
      toolId: "treg.people.search",
      method: "POST",
      body: {
        q: semanticQuery,
        limit,
      },
      headers: {
        "X-Treg-Route-Max-Cost": "0.05",
      },
      parse: (raw) =>
        normalizeTregPeopleSearchPage(raw, { start: args.start, count: limit }),
      isEmpty: (parsed) => parsed.people.length === 0,
    });
  }

  attempts.push({
    toolId: "harvestapi.linkedin.profile.search",
    method: "GET",
    query: {
      ...(args.searchMode === "title"
        ? { title: args.query }
        : { search: args.query }),
      geoId: args.geoUrn,
      location: args.geoUrn ? undefined : args.location,
      page,
    },
    parse: (raw) =>
      normalizeTregPeopleSearchPage(raw, { start: args.start, count: limit }),
  });

  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.searchPeople:${args.searchMode}:${args.query}`,
    attempts,
  });
  return result.data;
}

/** Search LinkedIn posts by keyword via harvestapi with anyapi and scrapecreators fallback. */
export async function searchTregLinkedInPostsPage(
  ctx: ActionCtx,
  args: {
    query: string;
    searchMode?: string;
    start: number;
    pageNumber?: number;
    paginationToken?: string;
    sortBy?: "relevance" | "date_posted";
    datePosted?: string;
    authorJobTitle?: string;
  }
): Promise<{
  posts: LinkedInPost[];
  total: number;
  start: number;
  count: number;
  hasMore: boolean;
  nextPaginationToken: string | null;
}> {
  const page = args.pageNumber ?? Math.max(1, Math.floor(args.start / 50) + 1);
  const attempts: TregCallAttempt<{
    posts: LinkedInPost[];
    total: number;
    start: number;
    count: number;
    hasMore: boolean;
    nextPaginationToken: string | null;
  }>[] = [
    {
      toolId: "harvestapi.linkedin.post.search",
      method: "GET",
      query: {
        search: args.query,
        sortBy: mapSortByToHarvest(args.sortBy),
        postedLimit: mapDatePostedToHarvestLimit(args.datePosted),
        authorKeywords: args.authorJobTitle,
        page,
        paginationToken: args.paginationToken,
      },
      parse: (raw) => normalizeTregSearchPostsPage(raw, { start: args.start }),
    },
    {
      toolId: "anyapi.linkedin.search.posts",
      method: "POST",
      body: {
        query: args.query,
        ...(mapDatePostedToAnyApi(args.datePosted)
          ? { datePosted: mapDatePostedToAnyApi(args.datePosted) }
          : {}),
      },
      parse: (raw) => normalizeTregSearchPostsPage(raw, { start: args.start }),
    },
    {
      toolId: "scrapecreators.x.v1-linkedin-search-posts",
      method: "GET",
      query: {
        keyword: args.query,
      },
      parse: (raw) => normalizeTregSearchPostsPage(raw, { start: args.start }),
    },
  ];

  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.searchPosts:${args.searchMode ?? "plain_relevance"}:${args.query}`,
    attempts,
  });
  return result.data;
}

/**
 * Search a specific LinkedIn member's posts (optionally filtered by keyword).
 *
 * Uses harvestapi post search when a public handle is available, and falls back
 * to fetchinio profile posts + local keyword filtering when only a raw URN is known.
 */
export async function searchTregLinkedInUserPosts(
  ctx: ActionCtx,
  args: {
    profileUrn: string;
    username?: string;
    keyword?: string;
    datePosted?: string;
    maxPosts: number;
    purpose?: LinkdApiPurpose;
  }
): Promise<LinkedInPost[]> {
  const handle =
    args.username?.trim() ||
    (!isRawProfileUrnId(args.profileUrn) ? args.profileUrn : undefined);
  const fetchCount = Math.min(Math.max(args.maxPosts * 2, 20), 50);

  const attempts: TregCallAttempt<LinkedInPost[]>[] = [];

  if (handle && args.keyword) {
    attempts.push({
      toolId: "harvestapi.linkedin.post.search",
      method: "GET",
      query: {
        profile: handle,
        search: args.keyword,
        sortBy: "date",
        postedLimit: mapDatePostedToHarvestLimit(args.datePosted),
        page: 1,
      },
      parse: (raw) =>
        normalizeTregSearchPostsPage(raw, { start: 0 }).posts.slice(
          0,
          args.maxPosts
        ),
      isEmpty: (posts) => posts.length === 0,
    });
  }

  const profileIdentifier = handle ?? args.profileUrn;
  attempts.push({
    toolId: "fetchinio.linkedin.user.posts",
    method: "GET",
    query: {
      profileUrlOrUrn: profileIdentifier,
      count: fetchCount,
    },
    parse: (raw) => {
      const page = normalizeTregProfilePostsPage(raw, { maxPosts: fetchCount });
      const searchPosts = page.posts.map((post) =>
        toLinkedInSearchPostFromProfilePost(post, args.profileUrn)
      );
      return filterLinkedInPostsByKeyword(searchPosts, args.keyword).slice(
        0,
        args.maxPosts
      );
    },
  });

  attempts.push({
    toolId: "treg.linkedin.user.posts",
    method: "POST",
    body: {
      linkedin_url: toLinkedInProfileUrl(profileIdentifier),
    },
    parse: (raw) => {
      const page = normalizeTregProfilePostsPage(raw, { maxPosts: fetchCount });
      const searchPosts = page.posts.map((post) =>
        toLinkedInSearchPostFromProfilePost(post, args.profileUrn)
      );
      return filterLinkedInPostsByKeyword(searchPosts, args.keyword).slice(
        0,
        args.maxPosts
      );
    },
  });

  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.searchUserPosts:${args.profileUrn}:${args.keyword ?? "all"}`,
    purpose: args.purpose,
    attempts,
  });
  return result.data;
}

/**
 * Fetch full LinkedIn user profile (plus overview fields and websites in 1 call)
 * via fetchinio with routed treg and harvestapi fallbacks.
 */
export async function fetchTregLinkedInProfile(
  ctx: ActionCtx,
  args: {
    username?: string;
    urn?: string;
    includeContactInfo?: boolean;
  }
): Promise<{
  profile: LinkedInProfile;
  supplemental: TregProfileSupplemental;
  contactInfo?: LinkedInContactInfo;
}> {
  const identifier = args.username?.trim() || args.urn?.trim() || "";
  const profileUrl = toLinkedInProfileUrl(identifier);

  const attempts: TregCallAttempt<{
    profile: LinkedInProfile;
    supplemental: TregProfileSupplemental;
  }>[] = [
    {
      toolId: "fetchinio.linkedin.user.profile",
      method: "GET",
      query: { profileUrlOrUrn: identifier },
      parse: normalizeTregUserProfile,
    },
    {
      toolId: "treg.linkedin.user.profile",
      method: "POST",
      body: { linkedin_url: profileUrl },
      parse: normalizeTregUserProfile,
    },
    {
      toolId: "harvestapi.linkedin.user.profile",
      method: "GET",
      query: args.username
        ? { publicIdentifier: args.username }
        : { profileId: identifier.replace(/^urn:li:fsd_profile:/i, "") },
      parse: normalizeTregUserProfile,
    },
  ];

  const { data } = await requestTregWithFallback(ctx, {
    consumer: `linkedin.getProfile:${identifier || "unknown"}`,
    attempts,
  });

  let contactInfo = data.supplemental.contactInfo;

  if (args.includeContactInfo && !contactInfo?.emailAddress) {
    try {
      const resolvedUrl = data.profile.username
        ? toLinkedInProfileUrl(data.profile.username)
        : profileUrl;
      const enriched = await requestTregWithFallback(ctx, {
        consumer: `linkedin.getProfileContactInfo:${data.profile.username || identifier}`,
        attempts: [
          {
            toolId: "treg.people.enrich",
            method: "POST",
            body: { linkedin_url: resolvedUrl },
            headers: { "X-Treg-Route-Max-Cost": "0.01" },
            parse: normalizeTregContactEnrichment,
          },
        ],
      });
      contactInfo = {
        emailAddress:
          enriched.data.emailAddress ?? contactInfo?.emailAddress ?? null,
        phoneNumber:
          enriched.data.phoneNumber ?? contactInfo?.phoneNumber ?? null,
        websites:
          (contactInfo?.websites?.length ?? 0) > 0
            ? contactInfo!.websites
            : enriched.data.websites,
      };
    } catch {
      // Optional contact enrichment should never fail the profile read.
    }
  }

  return {
    profile: data.profile,
    supplemental: data.supplemental,
    contactInfo,
  };
}

/** Fetch a LinkedIn member's recent posts via fetchinio with treg and harvestapi fallbacks. */
export async function fetchTregLinkedInProfilePosts(
  ctx: ActionCtx,
  args: {
    profileUrn: string;
    cursor?: string;
    maxPosts?: number;
  }
): Promise<{
  posts: LinkedInProfilePost[];
  nextCursor: string | null;
}> {
  const count = Math.min(Math.max(args.maxPosts ?? 20, 1), 50);
  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.getProfilePosts:${args.profileUrn}:${args.cursor ?? "first"}`,
    attempts: [
      {
        toolId: "fetchinio.linkedin.user.posts",
        method: "GET",
        query: {
          profileUrlOrUrn: args.profileUrn,
          count,
          paginationToken: args.cursor,
        },
        parse: (raw) =>
          normalizeTregProfilePostsPage(raw, { maxPosts: args.maxPosts }),
      },
      {
        toolId: "treg.linkedin.user.posts",
        method: "POST",
        body: {
          linkedin_url: toLinkedInProfileUrl(args.profileUrn),
          ...(args.cursor ? { cursor: args.cursor } : {}),
        },
        parse: (raw) =>
          normalizeTregProfilePostsPage(raw, { maxPosts: args.maxPosts }),
      },
      {
        toolId: "harvestapi.linkedin.user.posts",
        method: "GET",
        query: {
          profileId: args.profileUrn.replace(/^urn:li:fsd_profile:/i, ""),
          page: 1,
          paginationToken: args.cursor,
        },
        parse: (raw) =>
          normalizeTregProfilePostsPage(raw, { maxPosts: args.maxPosts }),
      },
    ],
  });
  return result.data;
}

/** Fetch LinkedIn post comments via fetchinio with treg and harvestapi fallbacks. */
export async function fetchTregLinkedInPostComments(
  ctx: ActionCtx,
  args: {
    urn: string;
    start?: number;
    count?: number;
    cursor?: string;
  }
): Promise<{
  comments: Array<Record<string, unknown>>;
  cursor: string | null;
}> {
  const postUrn = toLinkedInPostUrn(args.urn);
  const count = Math.min(Math.max(args.count ?? 20, 1), 100);
  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.getPostComments:${args.urn}`,
    attempts: [
      {
        toolId: "fetchinio.linkedin.post.comments",
        method: "GET",
        query: {
          postUrlOrUrn: postUrn,
          count,
          start: args.cursor ? undefined : args.start,
          paginationToken: args.cursor,
        },
        parse: normalizeTregPostCommentsPage,
      },
      {
        toolId: "treg.linkedin.post.comments",
        method: "POST",
        body: {
          post_id: postUrn,
          ...(args.cursor ? { cursor: args.cursor } : {}),
        },
        parse: normalizeTregPostCommentsPage,
      },
      {
        toolId: "harvestapi.linkedin.post.comments",
        method: "GET",
        query: {
          post: postUrn,
          page: 1,
        },
        parse: normalizeTregPostCommentsPage,
      },
    ],
  });
  return result.data;
}

/** Fetch LinkedIn company info via fetchinio with treg and harvestapi fallbacks. */
export async function fetchTregLinkedInCompany(
  ctx: ActionCtx,
  args: {
    id?: string;
    name?: string;
  }
): Promise<LinkedInCompany> {
  const identifier = args.name?.trim() || args.id?.trim() || "";
  const companyUrl = args.name?.trim()
    ? `https://www.linkedin.com/company/${args.name.trim()}/`
    : `https://www.linkedin.com/company/${identifier}/`;

  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.getCompany:${identifier || "unknown"}`,
    attempts: [
      {
        toolId: "fetchinio.linkedin.company.profile",
        method: "GET",
        query: { companyUrlOrUrn: identifier },
        parse: normalizeTregCompany,
      },
      {
        toolId: "treg.linkedin.company.profile",
        method: "POST",
        body: { linkedin_url: companyUrl },
        parse: normalizeTregCompany,
      },
      {
        toolId: "harvestapi.linkedin.company.profile",
        method: "GET",
        query: args.name?.trim()
          ? { universalName: args.name.trim() }
          : { companyId: args.id?.trim() },
        parse: normalizeTregCompany,
      },
    ],
  });
  return result.data;
}

/** Fetch LinkedIn company posts via harvestapi with tikhub fallback. */
export async function fetchTregLinkedInCompanyPosts(
  ctx: ActionCtx,
  args: {
    companyId: string;
    companyUniversalName?: string;
    cursor?: string;
  }
): Promise<{
  posts: LinkedInProfilePost[];
  nextCursor: string | null;
}> {
  const trimmedCursor = args.cursor?.trim();
  const numericPage =
    trimmedCursor && /^\d+$/.test(trimmedCursor)
      ? Math.max(1, Number.parseInt(trimmedCursor, 10))
      : 1;
  const paginationToken =
    trimmedCursor && !/^\d+$/.test(trimmedCursor) ? trimmedCursor : undefined;
  const companySlug = args.companyUniversalName?.trim() || args.companyId;

  const result = await requestTregWithFallback(ctx, {
    consumer: `linkedin.getCompanyPosts:${args.companyId}:${args.cursor ?? "first"}`,
    attempts: [
      {
        toolId: "harvestapi.linkedin.company.posts",
        method: "GET",
        query: {
          companyId: args.companyId,
          companyUniversalName: args.companyUniversalName,
          page: paginationToken ? undefined : numericPage,
          paginationToken,
        },
        parse: (raw) => normalizeTregProfilePostsPage(raw),
      },
      {
        toolId: "tikhub.x.linkedin-web-v2-get-company-posts",
        method: "GET",
        query: {
          url: `https://www.linkedin.com/company/${companySlug}/`,
        },
        parse: (raw) => normalizeTregProfilePostsPage(raw),
      },
    ],
  });
  return result.data;
}
