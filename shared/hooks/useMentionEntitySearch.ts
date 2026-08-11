"use client";

import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  normalizeMentionEntitySearchResult,
  type MentionEntityKind,
  type MentionEntitySearchResult,
} from "@/shared/lib/mentions/mentionEntities";
import {
  buildMentionEntityContentSignature,
  getLocalMentionResults,
} from "@/shared/lib/mentions/mentionSearch";

const mentionEntityCache = new Map<
  string,
  MentionEntitySearchResult[] | null
>();

function buildMentionEntityCacheKey(args: {
  query: string | null;
  workspaceId?: string | null;
  prospectId?: string | null;
  limit?: number;
  remoteAllowedKinds?: MentionEntityKind[];
  attachmentDestination?: {
    platform: "twitter" | "linkedin";
    surface: "comment" | "dm";
  };
}) {
  return [
    args.workspaceId ?? "workspace:none",
    args.prospectId ?? "prospect:none",
    args.limit ?? "limit:8",
    args.remoteAllowedKinds?.join(",") ?? "kinds:all",
    args.attachmentDestination
      ? `${args.attachmentDestination.platform}:${args.attachmentDestination.surface}`
      : "destination:none",
    args.query ?? "",
  ].join("::");
}

function mergeMentionResults(
  localResults: MentionEntitySearchResult[],
  remoteResults: MentionEntitySearchResult[],
  limit: number
) {
  const merged: MentionEntitySearchResult[] = [];
  const seenIds = new Set<string>();

  for (const entity of [...localResults, ...remoteResults]) {
    if (seenIds.has(entity.id)) {
      continue;
    }
    seenIds.add(entity.id);
    merged.push(entity);
    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

export function useMentionEntitySearch(args: {
  enabled?: boolean;
  query: string | null;
  workspaceId?: string | null;
  prospectId?: string | null;
  limit?: number;
  remoteAllowedKinds?: MentionEntityKind[];
  localEntities?: MentionEntitySearchResult[];
  attachmentDestination?: {
    platform: "twitter" | "linkedin";
    surface: "comment" | "dm";
  };
}) {
  const {
    enabled,
    query,
    workspaceId,
    prospectId,
    limit,
    remoteAllowedKinds,
    localEntities,
    attachmentDestination,
  } = args;
  const convex = useConvex();
  const [results, setResults] = useState<MentionEntitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const localEntitySignature =
    buildMentionEntityContentSignature(localEntities);
  const remoteAllowedKindsSignature = remoteAllowedKinds?.join(",") ?? "";

  useEffect(() => {
    if (!enabled || query === null) {
      const timeoutId = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const localResults = getLocalMentionResults({
      query,
      limit,
      localEntities,
    });
    const resultLimit = Math.max(1, Math.min(12, limit ?? 8));
    const shouldQueryRemote =
      remoteAllowedKinds === undefined || remoteAllowedKinds.length > 0;

    if (!shouldQueryRemote) {
      const timeoutId = window.setTimeout(() => {
        setResults(localResults);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const cacheKey = buildMentionEntityCacheKey({
      query,
      workspaceId,
      prospectId,
      limit,
      remoteAllowedKinds,
      attachmentDestination,
    });
    const cachedResults = mentionEntityCache.get(cacheKey);

    if (cachedResults === null) {
      const timeoutId = window.setTimeout(() => {
        setResults(localResults);
        setLoading(true);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    if (cachedResults !== undefined) {
      const timeoutId = window.setTimeout(() => {
        setResults(
          mergeMentionResults(localResults, cachedResults, resultLimit)
        );
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    mentionEntityCache.set(cacheKey, null);
    const timeoutId = window.setTimeout(() => {
      setResults(localResults);
      setLoading(true);
    }, 0);
    let cancelled = false;
    const loadingTimeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setLoading(false);
    }, 2500);

    void convex
      .query(api.mediaMentions.searchMentionEntities, {
        query,
        workspaceId: workspaceId
          ? (workspaceId as Id<"workspaces">)
          : undefined,
        prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
        limit,
        allowedKinds: remoteAllowedKinds,
        attachmentDestination,
      })
      .then((nextResults) => {
        if (cancelled) {
          return;
        }
        window.clearTimeout(loadingTimeoutId);
        const normalizedResults = nextResults
          .map((entity) =>
            normalizeMentionEntitySearchResult(
              entity as MentionEntitySearchResult
            )
          )
          .filter(
            (value): value is MentionEntitySearchResult => value !== null
          );
        mentionEntityCache.set(cacheKey, normalizedResults);
        setResults(
          mergeMentionResults(localResults, normalizedResults, resultLimit)
        );
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        window.clearTimeout(loadingTimeoutId);
        console.warn("[useMentionEntitySearch] Mention query failed", error);
        mentionEntityCache.set(cacheKey, []);
        setResults(localResults);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(loadingTimeoutId);
    };
  }, [
    enabled,
    limit,
    prospectId,
    query,
    workspaceId,
    attachmentDestination,
    convex,
    localEntities,
    localEntitySignature,
    remoteAllowedKinds,
    remoteAllowedKindsSignature,
  ]);

  return { results, loading };
}
