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
          loading={suggestionsLoading}
        />

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
