// features/search/ui/components/SearchContent.tsx
"use client";

import { memo } from "react";
import { Separator } from "@/shared/ui/components/Separator";
import { KeywordSuggestions } from "@/features/keywords/ui/components/KeywordSuggestions";
import { RecentKeywords } from "@/features/keywords/ui/components/RecentKeywords";
import { SimilarKeywords } from "@/features/keywords/ui/components/SimilarKeywords";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

interface SearchContentProps {
  suggestions: KeywordItem[];
  currentQuery: string;
  onKeywordClick: (item: KeywordItem) => void;
  loading?: boolean;
  className?: string;
}

export const SearchContent = memo<SearchContentProps>(function SearchContent({
  suggestions,
  currentQuery,
  onKeywordClick,
  loading = false,
  className,
}) {
  return (
    <div
      className={className}
      role="region"
      aria-label="Search suggestions"
      aria-live="polite"
    >
      <div className="space-y-2">
        <KeywordSuggestions
          suggestions={suggestions}
          onSuggestionClick={onKeywordClick}
          loading={loading}
          currentQuery={currentQuery}
          className="px-4"
        />

        <Separator />

        {/* Show similar keywords if there's a current query */}
        {currentQuery.trim() && (
          <>
            <SimilarKeywords
              currentQuery={currentQuery}
              onKeywordClick={onKeywordClick}
              loading={loading}
              maxResults={5}
              threshold={0.3}
              className="px-4"
            />
            <Separator />
          </>
        )}

        <RecentKeywords
          currentQuery={currentQuery}
          onKeywordClick={onKeywordClick}
          loading={loading}
          maxResults={5}
          className="px-4"
        />
      </div>
    </div>
  );
});
