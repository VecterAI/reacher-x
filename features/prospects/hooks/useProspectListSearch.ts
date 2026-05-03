"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useDebouncedValue } from "@/shared/lib/utils/useDebouncedValue";
import { QUERY_CHAR_LIMIT } from "@/shared/lib/utils/validation/queryLimit";

export const PROSPECTS_PER_PAGE = 10;

type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export type ProspectListSearchArgs = {
  workspaceId: Id<"workspaces"> | null;
  status: Doc<"prospectSummaries">["status"];
  visibilityMode?: "all" | "ready_only" | "actionable_only";
  platform?: Doc<"prospectSummaries">["platform"];
  prospectType?: Exclude<Doc<"prospects">["prospectType"], "unknown">;
  fitScoreMin?: number;
  fitScoreMax?: number;
  createdAfterMs?: number;
  createdBeforeMs?: number;
  searchQuery: string;
  browseResults: Doc<"prospectSummaries">[];
  browseStatus: PaginationStatus;
  browseLoadMore: (numItems: number) => void;
};

export function useProspectListSearch({
  workspaceId,
  status,
  visibilityMode,
  platform,
  prospectType,
  fitScoreMin,
  fitScoreMax,
  createdAfterMs,
  createdBeforeMs,
  searchQuery,
  browseResults,
  browseStatus,
  browseLoadMore,
}: ProspectListSearchArgs) {
  const searchUnified = useAction(
    api.prospectSearchUnified.searchProspectsUnified
  );
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const browseMode = searchQuery.trim() === "";
  const isDebouncing = !browseMode && debouncedSearch !== searchQuery;

  const [unifiedResults, setUnifiedResults] = useState<
    Doc<"prospectSummaries">[]
  >([]);
  const [unifiedCursor, setUnifiedCursor] = useState<string | undefined>(
    undefined
  );
  const [unifiedDone, setUnifiedDone] = useState(true);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedLoadingMore, setUnifiedLoadingMore] = useState(false);

  const unifiedCursorRef = useRef<string | undefined>(undefined);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    unifiedCursorRef.current = unifiedCursor;
  }, [unifiedCursor]);

  const effectiveQuery = debouncedSearch.trim().slice(0, QUERY_CHAR_LIMIT);

  useEffect(() => {
    if (browseMode) {
      requestGenerationRef.current += 1;
      return;
    }

    if (!workspaceId || effectiveQuery.length === 0) {
      return;
    }

    const gen = ++requestGenerationRef.current;

    const run = () => {
      if (gen !== requestGenerationRef.current) return;
      setUnifiedLoading(true);
      setUnifiedResults([]);
      setUnifiedCursor(undefined);
      unifiedCursorRef.current = undefined;
      setUnifiedDone(false);

      void searchUnified({
        workspaceId,
        status,
        platform,
        prospectType,
        fitScoreMin,
        fitScoreMax,
        createdAfterMs,
        createdBeforeMs,
        visibilityMode,
        searchQuery: effectiveQuery,
        paginationOpts: { numItems: PROSPECTS_PER_PAGE, cursor: null },
        unifiedCursor: undefined,
      })
        .then((res) => {
          if (gen !== requestGenerationRef.current) return;
          setUnifiedResults(res.page);
          setUnifiedCursor(res.continueCursor || undefined);
          unifiedCursorRef.current = res.continueCursor || undefined;
          setUnifiedDone(res.isDone);
        })
        .catch(() => {
          if (gen !== requestGenerationRef.current) return;
          setUnifiedResults([]);
          setUnifiedDone(true);
        })
        .finally(() => {
          if (gen !== requestGenerationRef.current) return;
          setUnifiedLoading(false);
        });
    };

    queueMicrotask(run);
  }, [
    browseMode,
    workspaceId,
    status,
    platform,
    prospectType,
    fitScoreMin,
    fitScoreMax,
    createdAfterMs,
    createdBeforeMs,
    visibilityMode,
    effectiveQuery,
    searchUnified,
  ]);

  const loadMoreUnified = useCallback(() => {
    if (
      !workspaceId ||
      browseMode ||
      effectiveQuery.length === 0 ||
      unifiedDone ||
      unifiedLoadingMore ||
      unifiedLoading
    ) {
      return;
    }

    const cursor = unifiedCursorRef.current;
    if (!cursor) {
      return;
    }

    const genAtStart = requestGenerationRef.current;
    setUnifiedLoadingMore(true);

    void searchUnified({
      workspaceId,
      status,
      platform,
      prospectType,
      fitScoreMin,
      fitScoreMax,
      createdAfterMs,
      createdBeforeMs,
      visibilityMode,
      searchQuery: effectiveQuery,
      paginationOpts: { numItems: PROSPECTS_PER_PAGE, cursor: null },
      unifiedCursor: cursor,
    })
      .then((res) => {
        if (genAtStart !== requestGenerationRef.current) return;
        setUnifiedResults((prev) => [...prev, ...res.page]);
        setUnifiedCursor(res.continueCursor || undefined);
        unifiedCursorRef.current = res.continueCursor || undefined;
        setUnifiedDone(res.isDone);
      })
      .catch(() => {
        if (genAtStart !== requestGenerationRef.current) return;
      })
      .finally(() => {
        if (genAtStart !== requestGenerationRef.current) return;
        setUnifiedLoadingMore(false);
      });
  }, [
    browseMode,
    workspaceId,
    status,
    platform,
    prospectType,
    fitScoreMin,
    fitScoreMax,
    createdAfterMs,
    createdBeforeMs,
    visibilityMode,
    effectiveQuery,
    unifiedDone,
    unifiedLoadingMore,
    unifiedLoading,
    searchUnified,
  ]);

  const displayProspects = browseMode
    ? browseResults
    : isDebouncing
      ? []
      : unifiedResults;

  const prospectIdsForMap = displayProspects.map((p) => p.prospectId);

  const isSearchLoading =
    !browseMode &&
    (isDebouncing || (unifiedLoading && unifiedResults.length === 0));

  const hasMore = browseMode
    ? browseStatus === "CanLoadMore" || browseStatus === "LoadingMore"
    : !unifiedDone;

  const isLoadingMore = browseMode
    ? browseStatus === "LoadingMore"
    : unifiedLoadingMore;

  const loadMore = useCallback(() => {
    if (browseMode) {
      browseLoadMore(PROSPECTS_PER_PAGE);
    } else {
      loadMoreUnified();
    }
  }, [browseMode, browseLoadMore, loadMoreUnified]);

  return {
    browseMode,
    displayProspects,
    prospectIdsForMap,
    isSearchLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  };
}
