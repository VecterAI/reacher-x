// app/(webapp)/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/shared/ui/components/Separator";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { KeywordSuggestions } from "@/features/keywords/ui/components/KeywordSuggestions";
import { RecentKeywords } from "@/features/keywords/ui/components/RecentKeywords";
import { SimilarKeywords } from "@/features/keywords/ui/components/SimilarKeywords";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { useKeywordRePrompt } from "@/shared/hooks/useKeywordRePrompt";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

export default function WebAppPage() {
  const router = useRouter();
  const [currentQuery, setCurrentQuery] = useState("");
  const { history: historyKeywords, isLoaded } = useSearchHistory();

  // Use the keyword suggestions hook
  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    hasValidDescription,
    recordKeywordUsage,
  } = useKeywordSuggestions();

  // Use the keyword re-prompt hook for automatic improvement
  const { isRePrompting, getFlaggedKeywordsCount, insights } =
    useKeywordRePrompt();

  // Get flagged keywords count for status display
  const flaggedCount = getFlaggedKeywordsCount();

  const handleSearch = useCallback(
    (query: string, exactMatch: boolean) => {
      const params = new URLSearchParams();
      params.set("q", query);
      if (exactMatch) params.set("exact", "true");

      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  const handleKeywordClick = useCallback(
    (item: KeywordItem) => {
      // Record keyword usage for performance tracking
      recordKeywordUsage(item.id, item.keyword);

      const params = new URLSearchParams();
      params.set("q", item.keyword);
      // Include keyword ID for vote tracking
      params.set("keywordId", item.id);

      router.push(`/search?${params.toString()}`);
    },
    [router, recordKeywordUsage]
  );

  const handleQueryChange = useCallback((query: string) => {
    setCurrentQuery(query);
  }, []);

  // Get recent keywords (limit to 5 for homepage)
  const recentKeywords = historyKeywords.slice(0, 5);

  return (
    <div className="mx-auto mt-12 max-w-lg px-4">
      <h1 className="mb-4 text-center text-2xl font-medium">
        Who will you{" "}
        <span className="text-muted-foreground line-through">sell</span> help?
      </h1>

      <SearchInput
        onSearch={handleSearch}
        onQueryChange={handleQueryChange}
        placeholder="Type keywords..."
        className="mb-4"
      />

      <div className="space-y-2">
        <KeywordSuggestions
          suggestions={suggestions}
          onSuggestionClick={handleKeywordClick}
          loading={suggestionsLoading || isRePrompting}
        />

        {/* Show re-prompting status */}
        {isRePrompting && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
            🔄 Improving keyword suggestions based on your feedback...
          </div>
        )}

        {/* Show insights when available */}
        {insights && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/50 dark:text-green-200">
            <div className="font-medium">💡 Keyword Performance Insights</div>
            {insights.highPerformingPatterns.length > 0 && (
              <div className="mt-1">
                <span className="font-medium">Working well:</span>{" "}
                {insights.highPerformingPatterns.join(", ")}
              </div>
            )}
            {insights.recommendedAdjustments.length > 0 && (
              <div className="mt-1">
                <span className="font-medium">Improvements:</span>{" "}
                {insights.recommendedAdjustments.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Show keyword performance status */}
        {flaggedCount > 0 && !isRePrompting && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-900/50 dark:text-orange-200">
            📊 {flaggedCount} keyword{flaggedCount !== 1 ? "s" : ""} ready for
            performance-based improvements
          </div>
        )}

        {/* Show error state if keyword generation failed */}
        {suggestionsError && !hasValidDescription && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            Complete your workspace setup to get AI-powered keyword suggestions.
          </div>
        )}

        {suggestionsError && hasValidDescription && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/50 dark:text-red-200">
            {suggestionsError}
          </div>
        )}

        <Separator />

        {/* Show similar keywords if user has typed something */}
        {currentQuery.trim() && (
          <>
            <SimilarKeywords
              allKeywords={historyKeywords}
              currentQuery={currentQuery}
              onKeywordClick={handleKeywordClick}
              loading={!isLoaded}
              maxResults={5}
              threshold={0.3}
            />
            <Separator />
          </>
        )}

        <RecentKeywords
          keywords={recentKeywords}
          onKeywordClick={handleKeywordClick}
          loading={!isLoaded}
        />
      </div>
    </div>
  );
}
