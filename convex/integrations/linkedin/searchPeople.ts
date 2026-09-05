"use node";

import { v } from "convex/values";
import type { RunId } from "@convex-dev/action-retrier";
import type { ActionCtx } from "../../_generated/server";
import { action, internalAction } from "../../lib/functionBuilders";
import { internal } from "../../_generated/api";
import { getRetriedActionStatus, runRetriedAction } from "../../lib/retrier";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import {
  buildLinkedInPeopleSearchAttempts,
  extractLinkedInGeoId,
  getNextLinkedInPeopleSearchStart,
  LINKEDIN_PEOPLE_DEFAULT_COUNT,
  LINKEDIN_PEOPLE_MAX_PAGES_PER_QUERY,
  type LinkedInPeopleSearchAttempt,
} from "../../lib/linkedinSearchHelpers";
import { requestLinkdApiData } from "./linkdapiClient";

export interface LinkedInPerson {
  urn: string;
  profileID: string;
  url: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  location: string;
  profilePictureURL: string;
  premium: boolean;
}

interface ApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  errors: unknown;
  data: {
    people: LinkedInPerson[];
    total: number;
    start: number;
    count: number;
    hasMore: boolean;
  };
}

interface InternalSearchPeopleResult {
  success: boolean;
  people: LinkedInPerson[];
  total: number;
  start: number;
  hasMore: boolean;
  searchMode: "title" | "keyword";
  error?: string;
}

export interface LinkedInPeopleQueryStat {
  query: string;
  peopleFound: number;
  success: boolean;
  searchMode: "title" | "keyword";
  error?: string;
}

export interface LinkedInPeopleBatchSearchResult {
  success: boolean;
  people: LinkedInPerson[];
  matchedQueriesByPersonUrn: Record<string, string[]>;
  errors: Array<{ query: string; error: string }>;
  queryStats: LinkedInPeopleQueryStat[];
  queryResults: Array<{
    query: string;
    searchMode: "title" | "keyword";
    peopleFound: number;
    requestedLocation?: string;
    geoUrn?: string;
    profileLanguage?: string;
  }>;
  stats: {
    queriesExecuted: number;
    queriesSucceeded: number;
    queriesFailed: number;
    totalPeopleFound: number;
    uniquePeople: number;
    durationMs: number;
  };
}

function deduplicatePeople(people: LinkedInPerson[]) {
  const seen = new Map<string, LinkedInPerson>();

  for (const person of people) {
    const key = person.urn || person.profileID || person.url;
    if (!key || seen.has(key)) continue;
    seen.set(key, person);
  }

  return Array.from(seen.values());
}

function normalizeQueryList(queries: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const query of queries) {
    const trimmed = query.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function looksLikeRoleTitleQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  const titleSignals = [
    "developer",
    "engineer",
    "designer",
    "marketer",
    "founder",
    "manager",
    "specialist",
    "architect",
    "consultant",
    "recruiter",
    "product",
    "frontend",
    "backend",
    "full stack",
    "fullstack",
    "staff",
    "principal",
    "lead",
    "head of",
    "director",
  ];

  if (normalized.split(/\s+/).length <= 5) {
    return titleSignals.some((signal) => normalized.includes(signal));
  }

  return false;
}

const RETRIED_ACTION_POLL_INTERVAL_MS = 500;
const RETRIED_ACTION_MAX_POLL_ATTEMPTS = 120;

async function waitForPeopleSearchResult(
  ctx: ActionCtx,
  runId: RunId
): Promise<InternalSearchPeopleResult> {
  let pollAttempts = 0;

  while (pollAttempts < RETRIED_ACTION_MAX_POLL_ATTEMPTS) {
    const status = await getRetriedActionStatus(ctx, runId);
    if (status.type === "inProgress") {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRIED_ACTION_POLL_INTERVAL_MS)
      );
      pollAttempts += 1;
      continue;
    }

    if (status.type === "completed") {
      if (status.result.type === "success") {
        return status.result.returnValue as InternalSearchPeopleResult;
      }

      if (status.result.type === "failed") {
        throw new Error(status.result.error);
      }

      throw new Error("Request was canceled");
    }
  }

  throw new Error("Timeout waiting for result");
}

async function collectPaginatedPeopleResults(
  ctx: ActionCtx,
  args: {
    query: string;
    searchMode: "title" | "keyword";
    geoUrn?: string;
    profileLanguage?: string;
    count: number;
    initialResult: InternalSearchPeopleResult;
  }
): Promise<InternalSearchPeopleResult> {
  const people = [...args.initialResult.people];
  let lastResult = args.initialResult;
  let nextStart = getNextLinkedInPeopleSearchStart(
    args.initialResult.start,
    args.count
  );
  const seenStarts = new Set<number>([args.initialResult.start]);

  for (
    let pageIndex = 1;
    pageIndex < LINKEDIN_PEOPLE_MAX_PAGES_PER_QUERY;
    pageIndex += 1
  ) {
    if (!lastResult.hasMore || seenStarts.has(nextStart)) {
      break;
    }

    seenStarts.add(nextStart);

    try {
      const runId = await runRetriedAction(
        ctx,
        internal.integrations.linkedin.searchPeople.searchInternal,
        {
          query: args.query,
          searchMode: args.searchMode,
          geoUrn: args.geoUrn,
          profileLanguage: args.profileLanguage,
          start: nextStart,
          count: args.count,
        }
      );
      const pageResult = await waitForPeopleSearchResult(ctx, runId);

      people.push(...pageResult.people);
      lastResult = pageResult;
      nextStart = getNextLinkedInPeopleSearchStart(
        pageResult.start,
        args.count
      );
    } catch {
      break;
    }
  }

  return {
    ...lastResult,
    people,
    searchMode: args.searchMode,
  };
}

async function resolveGeoUrn(
  ctx: ActionCtx,
  location: string | undefined
): Promise<string | undefined> {
  const normalized = location?.trim();
  if (!normalized) return undefined;

  try {
    const data = await requestLinkdApiData<unknown>(ctx, {
      path: "/api/v1/geos/name-lookup",
      query: { query: normalized },
      consumer: `linkedin.searchPeople.geoLookup:${normalized}`,
    });
    return extractLinkedInGeoId(data);
  } catch (error) {
    console.warn(
      "[LinkedInSearchPeople] Location lookup failed; continuing without geoUrn",
      error
    );
    return undefined;
  }
}

export const searchInternal = internalAction({
  args: {
    query: v.string(),
    searchMode: v.union(v.literal("title"), v.literal("keyword")),
    start: v.optional(v.number()),
    count: v.optional(v.number()),
    geoUrn: v.optional(v.string()),
    profileLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<InternalSearchPeopleResult> => {
    const data = await requestLinkdApiData<ApiResponse["data"]>(ctx, {
      path: "/api/v1/search/people",
      query: {
        [args.searchMode === "title" ? "title" : "keyword"]: args.query,
        geoUrn: args.geoUrn,
        profileLanguage: args.profileLanguage,
        count: args.count ?? LINKEDIN_PEOPLE_DEFAULT_COUNT,
        start: args.start,
      },
      consumer: `linkedin.searchPeople:${args.searchMode}:${args.query}`,
    });

    return {
      success: true,
      people: data.people ?? [],
      total: data.total,
      start: data.start,
      hasMore: data.hasMore,
      searchMode: args.searchMode,
    };
  },
});

export const searchBatch = action({
  args: {
    queries: v.array(v.string()),
    count: v.optional(v.number()),
    maxQueriesPerBatch: v.optional(v.number()),
    location: v.optional(v.string()),
    profileLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<LinkedInPeopleBatchSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const requestedCount = args.count ?? LINKEDIN_PEOPLE_DEFAULT_COUNT;
    const geoUrn = await resolveGeoUrn(ctx, args.location);
    const queriesToExecute = normalizeQueryList(args.queries).slice(
      0,
      args.maxQueriesPerBatch ?? 20
    );

    if (queriesToExecute.length === 0) {
      return {
        success: false,
        people: [],
        matchedQueriesByPersonUrn: {},
        errors: [{ query: "*", error: "No valid queries provided" }],
        queryStats: [],
        queryResults: [],
        stats: {
          queriesExecuted: 0,
          queriesSucceeded: 0,
          queriesFailed: 0,
          totalPeopleFound: 0,
          uniquePeople: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    const runPromises: Array<{
      query: string;
      attempts: LinkedInPeopleSearchAttempt[];
      runIdPromise: Promise<RunId>;
    }> = [];

    for (let index = 0; index < queriesToExecute.length; index += 1) {
      const query = queriesToExecute[index];
      const attempts = buildLinkedInPeopleSearchAttempts({
        searchModes: looksLikeRoleTitleQuery(query)
          ? ["title", "keyword"]
          : ["keyword"],
        geoUrn,
        profileLanguage: args.profileLanguage,
      });
      const runIdPromise = new Promise<RunId>((resolve, reject) => {
        void (async () => {
          try {
            const runId = await runRetriedAction(
              ctx,
              internal.integrations.linkedin.searchPeople.searchInternal,
              {
                query,
                searchMode: attempts[0].searchMode,
                geoUrn: attempts[0].geoUrn,
                profileLanguage: attempts[0].profileLanguage,
                count: requestedCount,
              }
            );
            resolve(runId);
          } catch (error) {
            reject(error);
          }
        })();
      });

      runPromises.push({ query, attempts, runIdPromise });
    }

    const runIds: Array<{
      query: string;
      attempts: LinkedInPeopleSearchAttempt[];
      runId: RunId | null;
      error?: string;
    }> = [];

    for (const { query, attempts, runIdPromise } of runPromises) {
      try {
        const runId = await runIdPromise;
        runIds.push({ query, attempts, runId });
      } catch (error) {
        runIds.push({
          query,
          attempts,
          runId: null,
          error: error instanceof Error ? error.message : "Failed to start",
        });
      }
    }

    const allPeople: LinkedInPerson[] = [];
    const matchedQueriesByPersonUrn = new Map<string, Set<string>>();
    const errors: Array<{ query: string; error: string }> = [];
    const queryStats: LinkedInPeopleQueryStat[] = [];
    const queryResults: LinkedInPeopleBatchSearchResult["queryResults"] = [];
    let queriesSucceeded = 0;
    let totalPeopleFound = 0;

    for (const { query, attempts, runId, error: startError } of runIds) {
      if (!runId) {
        errors.push({ query, error: startError ?? "Failed to start" });
        queryStats.push({
          query,
          peopleFound: 0,
          success: false,
          searchMode: attempts[0].searchMode,
          error: startError ?? "Failed to start",
        });
        continue;
      }

      try {
        let activeRunId: RunId | null = runId;
        let finalMode: "title" | "keyword" = attempts[0].searchMode;
        let finalAttempt = attempts[0];
        let matched = false;
        let finalError: string | undefined;

        for (
          let attemptIndex = 0;
          attemptIndex < attempts.length;
          attemptIndex += 1
        ) {
          const attempt = attempts[attemptIndex];
          finalAttempt = attempt;
          const searchMode = attempt.searchMode;
          let result: InternalSearchPeopleResult | null = null;
          try {
            const initialResult = await waitForPeopleSearchResult(
              ctx,
              activeRunId!
            );
            result = await collectPaginatedPeopleResults(ctx, {
              query,
              searchMode,
              geoUrn: attempt.geoUrn,
              profileLanguage: attempt.profileLanguage,
              count: requestedCount,
              initialResult,
            });
          } catch (error) {
            finalError =
              error instanceof Error ? error.message : "Unknown error";
          }

          if (result && result.success && result.people.length > 0) {
            allPeople.push(...result.people);
            totalPeopleFound += result.people.length;
            queriesSucceeded += 1;
            finalMode = result.searchMode;
            queryStats.push({
              query,
              peopleFound: result.people.length,
              success: true,
              searchMode: result.searchMode,
            });
            queryResults.push({
              requestedLocation: args.location,
              geoUrn: finalAttempt.geoUrn,
              profileLanguage: finalAttempt.profileLanguage,
              query,
              searchMode: result.searchMode,
              peopleFound: result.people.length,
            });

            for (const person of result.people) {
              const key = person.urn || person.profileID || person.url;
              if (!key) continue;
              const matchedQueries =
                matchedQueriesByPersonUrn.get(key) ?? new Set<string>();
              matchedQueries.add(query);
              matchedQueriesByPersonUrn.set(key, matchedQueries);
            }

            matched = true;
            break;
          }

          if (attemptIndex === attempts.length - 1) {
            finalMode = searchMode;
            finalError = result?.error ?? finalError;
            break;
          }

          const nextAttempt = attempts[attemptIndex + 1];
          activeRunId = await runRetriedAction(
            ctx,
            internal.integrations.linkedin.searchPeople.searchInternal,
            {
              query,
              searchMode: nextAttempt.searchMode,
              geoUrn: nextAttempt.geoUrn,
              profileLanguage: nextAttempt.profileLanguage,
              count: requestedCount,
            }
          );
        }

        if (!matched) {
          queryStats.push({
            query,
            peopleFound: 0,
            success: false,
            searchMode: finalMode,
            error: finalError ?? "Unknown error",
          });

          if (finalError) {
            errors.push({ query, error: finalError });
          } else {
            queryResults.push({
              requestedLocation: args.location,
              geoUrn: finalAttempt.geoUrn,
              profileLanguage: finalAttempt.profileLanguage,
              query,
              searchMode: finalMode,
              peopleFound: 0,
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ query, error: errorMessage });
        queryStats.push({
          query,
          peopleFound: 0,
          success: false,
          searchMode: attempts[0].searchMode,
          error: errorMessage,
        });
      }
    }

    const people = deduplicatePeople(allPeople);

    return {
      success: queriesSucceeded > 0,
      people,
      matchedQueriesByPersonUrn: Object.fromEntries(
        Array.from(matchedQueriesByPersonUrn.entries()).map(
          ([urn, queries]) => [urn, Array.from(queries)]
        )
      ),
      errors,
      queryStats,
      queryResults,
      stats: {
        queriesExecuted: queriesToExecute.length,
        queriesSucceeded,
        queriesFailed: errors.length,
        totalPeopleFound,
        uniquePeople: people.length,
        durationMs: getCurrentUTCTimestamp() - startTime,
      },
    };
  },
});
