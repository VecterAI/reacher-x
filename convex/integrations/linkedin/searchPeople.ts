"use node";

import { v } from "convex/values";
import type { RunId } from "@convex-dev/action-retrier";
import { action, internalAction } from "../../lib/functionBuilders";
import { internal } from "../../_generated/api";
import { retrier } from "../../lib/retrier";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
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

export const searchInternal = internalAction({
  args: {
    query: v.string(),
    searchMode: v.union(v.literal("title"), v.literal("keyword")),
    start: v.optional(v.number()),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InternalSearchPeopleResult> => {
    const data = await requestLinkdApiData<ApiResponse["data"]>(ctx, {
      path: "/api/v1/search/people",
      query: {
        [args.searchMode === "title" ? "title" : "keyword"]: args.query,
        count: args.count ?? 10,
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
  },
  handler: async (ctx, args): Promise<LinkedInPeopleBatchSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
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
      attempts: Array<"title" | "keyword">;
      runIdPromise: Promise<RunId>;
    }> = [];

    for (let index = 0; index < queriesToExecute.length; index += 1) {
      const query = queriesToExecute[index];
      const attempts = looksLikeRoleTitleQuery(query)
        ? (["title", "keyword"] as Array<"title" | "keyword">)
        : (["keyword"] as Array<"title" | "keyword">);
      const runIdPromise = new Promise<RunId>((resolve, reject) => {
        void (async () => {
          try {
            const runId = await retrier.run(
              ctx,
              internal.integrations.linkedin.searchPeople.searchInternal,
              {
                query,
                searchMode: attempts[0],
                count: args.count,
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
      attempts: Array<"title" | "keyword">;
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
    const queryResults: Array<{
      query: string;
      searchMode: "title" | "keyword";
      peopleFound: number;
    }> = [];
    let queriesSucceeded = 0;
    let totalPeopleFound = 0;

    for (const { query, attempts, runId, error: startError } of runIds) {
      if (!runId) {
        errors.push({ query, error: startError ?? "Failed to start" });
        queryStats.push({
          query,
          peopleFound: 0,
          success: false,
          searchMode: attempts[0],
          error: startError ?? "Failed to start",
        });
        continue;
      }

      try {
        let activeRunId: RunId | null = runId;
        let finalMode: "title" | "keyword" = attempts[0];
        let matched = false;
        let finalError: string | undefined;

        for (
          let attemptIndex = 0;
          attemptIndex < attempts.length;
          attemptIndex += 1
        ) {
          const searchMode = attempts[attemptIndex];
          let result: InternalSearchPeopleResult | null = null;
          let pollAttempts = 0;
          const maxAttempts = 120;

          while (pollAttempts < maxAttempts) {
            const status = await retrier.status(ctx, activeRunId!);
            if (status.type === "inProgress") {
              await new Promise((resolve) => setTimeout(resolve, 500));
              pollAttempts += 1;
              continue;
            }

            if (status.type === "completed") {
              if (status.result.type === "success") {
                result = status.result
                  .returnValue as InternalSearchPeopleResult;
              } else if (status.result.type === "failed") {
                finalError = status.result.error;
              } else {
                finalError = "Request was canceled";
              }
            }
            break;
          }

          if (pollAttempts >= maxAttempts) {
            finalError = "Timeout waiting for result";
            break;
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

          const nextMode = attempts[attemptIndex + 1];
          activeRunId = await retrier.run(
            ctx,
            internal.integrations.linkedin.searchPeople.searchInternal,
            {
              query,
              searchMode: nextMode,
              count: args.count,
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
          searchMode: attempts[0],
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
