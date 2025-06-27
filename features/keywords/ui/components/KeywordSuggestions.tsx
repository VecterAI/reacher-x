// features/keywords/ui/components/KeywordSuggestions.tsx
"use client";

import { memo, useMemo } from "react";
import { KeywordList, type KeywordItem } from "./KeywordList";

interface KeywordSuggestionsProps {
  suggestions: KeywordItem[];
  onSuggestionClick?: (item: KeywordItem) => void;
  loading?: boolean;
  className?: string;
  /** Current search query to filter out from suggestions */
  currentQuery?: string;
}

export const KeywordSuggestions = memo<KeywordSuggestionsProps>(
  function KeywordSuggestions({
    suggestions,
    onSuggestionClick,
    loading = false,
    className,
    currentQuery = "",
  }) {
    // Filter out current query from suggestions (defensive)
    const filteredSuggestions = useMemo(() => {
      if (!currentQuery.trim()) return suggestions;

      return suggestions.filter(
        (item) =>
          item.keyword.toLowerCase().trim() !==
          currentQuery.toLowerCase().trim()
      );
    }, [suggestions, currentQuery]);
    if (loading) {
      return (
        <section
          className={className}
          aria-label="Keyword suggestions"
          aria-busy="true"
          role="region"
        >
          <dl className="m-0">
            <dt className="mx-3.5 mb-3 text-sm font-medium text-muted-foreground">
              Try these ↴
            </dt>
            <dd className="m-0">
              <div
                className="space-y-2"
                role="status"
                aria-label="Loading keyword suggestions"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-md bg-muted"
                    aria-hidden="true"
                  />
                ))}
                <span className="sr-only">Loading suggested keywords...</span>
              </div>
            </dd>
          </dl>
        </section>
      );
    }

    return (
      <section
        className={className}
        aria-label={`${filteredSuggestions.length} keyword suggestions`}
        role="region"
      >
        <dl className="m-0">
          <dt className="mx-3.5 mb-2 text-xs font-medium text-muted-foreground">
            Try these ↴
          </dt>
          <dd className="m-0">
            <KeywordList
              items={filteredSuggestions}
              onKeywordClick={onSuggestionClick}
              emptyMessage="No suggestions available"
              listLabel="Suggested keywords"
            />
          </dd>
        </dl>
      </section>
    );
  }
);
