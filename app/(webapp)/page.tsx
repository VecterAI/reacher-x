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
    userDescription,
    fromCache,
    cacheAge,
    generationMetadata,
    totalTrackedKeywords,
    highValueKeywords,
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

      {/* Enhanced debug info for keyword suggestions */}
      {process.env.NODE_ENV === "development" && (
        <div className="mb-4 space-y-1 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          <div className="font-medium">Keyword Suggestions Debug:</div>
          <div>Current Query: &quot;{currentQuery}&quot;</div>
          <div>Suggestions Count: {suggestions.length}</div>
          <div>Loading: {suggestionsLoading ? "Yes" : "No"}</div>
          <div>Is Re-prompting: {isRePrompting ? "Yes" : "No"}</div>
          <div>Has Valid Description: {hasValidDescription ? "Yes" : "No"}</div>
          <div>From Cache: {fromCache ? "Yes" : "No"}</div>
          <div>
            User Description:{" "}
            {userDescription ? `${userDescription.length} chars` : "None"}
          </div>
          <div>History Loaded: {isLoaded ? "Yes" : "No"}</div>
          <div>Recent Keywords: {recentKeywords.length}</div>
          <div>Flagged Count: {flaggedCount}</div>
          <div>Total Tracked: {totalTrackedKeywords}</div>
          <div>High Value: {highValueKeywords}</div>

          {generationMetadata.requestId && (
            <div className="space-y-1 border-t pt-1">
              <div>Generation Meta:</div>
              <div>• Request ID: {generationMetadata.requestId}</div>
              {generationMetadata.processingTimeMs && (
                <div>• Processing: {generationMetadata.processingTimeMs}ms</div>
              )}
              {generationMetadata.llmProcessingTimeMs && (
                <div>
                  • LLM Time: {generationMetadata.llmProcessingTimeMs}ms
                </div>
              )}
              {generationMetadata.modelUsed && (
                <div>• Model: {generationMetadata.modelUsed}</div>
              )}
              {generationMetadata.usedFallback && (
                <div>• Used Fallback: Yes</div>
              )}
              {generationMetadata.confidenceStats && (
                <div>
                  • Confidence:{" "}
                  {generationMetadata.confidenceStats.min.toFixed(2)}-
                  {generationMetadata.confidenceStats.max.toFixed(2)} (avg:{" "}
                  {generationMetadata.confidenceStats.avg.toFixed(2)})
                </div>
              )}
            </div>
          )}

          {insights && (
            <div className="space-y-1 border-t pt-1">
              <div>Performance Insights:</div>
              {insights.highPerformingPatterns.length > 0 && (
                <div>
                  • High Performing:{" "}
                  {insights.highPerformingPatterns.join(", ")}
                </div>
              )}
              {insights.recommendedAdjustments.length > 0 && (
                <div>
                  • Adjustments: {insights.recommendedAdjustments.join(", ")}
                </div>
              )}
            </div>
          )}

          {suggestionsError && (
            <div className="text-destructive">Error: {suggestionsError}</div>
          )}

          {cacheAge && (
            <div>
              Cache Age: {Math.round((Date.now() - cacheAge) / 1000)}s ago
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <KeywordSuggestions
          suggestions={suggestions}
          onSuggestionClick={handleKeywordClick}
          loading={suggestionsLoading || isRePrompting}
          currentQuery={currentQuery}
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
          currentQuery={currentQuery}
          onKeywordClick={handleKeywordClick}
          loading={!isLoaded}
          maxResults={5}
        />
      </div>
    </div>
  );
}
