// features/keywords/ui/components/RecentKeywords.tsx
"use client";

import { memo, useMemo } from "react";
import { KeywordList, type KeywordItem } from "./KeywordList";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";

interface RecentKeywordsProps {
  /** Current search query to filter out from results */
  currentQuery?: string;
  onKeywordClick?: (item: KeywordItem) => void;
  loading?: boolean;
  className?: string;
  /** Maximum number of recent keywords to display */
  maxResults?: number;
}

export const RecentKeywords = memo<RecentKeywordsProps>(
  function RecentKeywords({
    currentQuery = "",
    onKeywordClick,
    loading = false,
    className,
    maxResults = 5,
  }) {
    // Get search history
    const { history, isLoaded } = useSearchHistory();

    // Filter out current query and limit results
    const recentKeywords = useMemo(() => {
      const filtered = currentQuery
        ? history.filter(
            (item) =>
              item.keyword.toLowerCase().trim() !==
              currentQuery.toLowerCase().trim()
          )
        : history;

      return filtered.slice(0, maxResults);
    }, [history, currentQuery, maxResults]);

    const isLoading = loading || !isLoaded;
    if (isLoading) {
      return (
        <section
          className={className}
          aria-label="Recent keywords"
          aria-busy="true"
          role="region"
        >
          <dl className="m-0">
            <dt className="mx-3.5 mb-2 text-xs font-medium text-muted-foreground">
              Recent ↴
            </dt>
            <dd className="m-0">
              <div
                className="space-y-2"
                role="status"
                aria-label="Loading recent keywords"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-md bg-muted"
                    aria-hidden="true"
                  />
                ))}
                <span className="sr-only">Loading recent keywords...</span>
              </div>
            </dd>
          </dl>
        </section>
      );
    }

    return (
      <section
        className={className}
        aria-label={`${recentKeywords.length} recent keywords`}
        role="region"
      >
        <dl className="m-0">
          <dt className="mx-3.5 mb-2 text-xs font-medium text-muted-foreground">
            Recent ↴
          </dt>
          <dd className="m-0">
            <KeywordList
              items={recentKeywords}
              onKeywordClick={onKeywordClick}
              showTimestamp={true}
              emptyMessage="No recent keywords"
              listLabel="Recent keywords, ordered by most recent"
            />
          </dd>
        </dl>
      </section>
    );
  }
);
