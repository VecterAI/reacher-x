// app/(webapp)/search/input/page.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Separator } from "@/shared/ui/components/Separator";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { KeywordSuggestions } from "@/features/keywords/ui/components/KeywordSuggestions";
import { RecentKeywords } from "@/features/keywords/ui/components/RecentKeywords";
import { SimilarKeywords } from "@/features/keywords/ui/components/SimilarKeywords";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

// Mock data - same as home page
const mockSuggestions: KeywordItem[] = [
  { id: "1", keyword: "help me in web dev" },
  { id: "2", keyword: "can't do web dev" },
  { id: "3", keyword: "web dev sucks" },
  { id: "4", keyword: "need a web dev" },
  { id: "5", keyword: "suck at web dev" },
];

const mockAllKeywords: KeywordItem[] = [
  { id: "6", keyword: "need a web dev", timestamp: "Mar 22, 2025" },
  { id: "7", keyword: "suck at web dev", timestamp: "9h" },
  { id: "8", keyword: "web dev suck", timestamp: "Mar 22, 2025" },
  { id: "9", keyword: "web dev sucks", timestamp: "10h" },
  { id: "10", keyword: "mobile dev sucks", timestamp: "Mar 21, 2025" },
  { id: "11", keyword: "help with web development", timestamp: "Mar 20, 2025" },
  { id: "12", keyword: "web developer needed", timestamp: "Mar 19, 2025" },
  { id: "13", keyword: "frontend development help", timestamp: "Mar 18, 2025" },
  { id: "14", keyword: "struggling with web dev", timestamp: "Mar 17, 2025" },
  {
    id: "15",
    keyword: "web programming assistance",
    timestamp: "Mar 16, 2025",
  },
];

export default function SearchInputPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialExactMatch = searchParams.get("exact") === "true";

  const [currentQuery, setCurrentQuery] = useState(initialQuery);
  const [loading] = useState(false);

  // Get recent keywords (excluding current query)
  const recentKeywords = useMemo(
    () =>
      mockAllKeywords
        .filter(
          (item) => item.keyword.toLowerCase() !== currentQuery.toLowerCase()
        )
        .slice(0, 5),
    [currentQuery]
  );

  const handleSearch = useCallback(
    (query: string, exactMatch: boolean) => {
      console.log("Search:", { query, exactMatch });

      // Navigate to search results
      const params = new URLSearchParams();
      params.set("q", query);
      if (exactMatch) params.set("exact", "true");

      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  const handleKeywordClick = useCallback(
    (item: KeywordItem) => {
      console.log("Keyword clicked:", item);

      // Navigate to search results with selected keyword
      const params = new URLSearchParams();
      params.set("q", item.keyword);

      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  const handleQueryChange = useCallback((query: string) => {
    setCurrentQuery(query);
  }, []);

  return (
    <div className="max-w-lg border-border pt-4 md:min-h-screen md:border-r-[1px]">
      <SearchInput
        onSearch={handleSearch}
        onQueryChange={handleQueryChange}
        placeholder="Type keywords..."
        defaultValue={initialQuery}
        defaultExactMatch={initialExactMatch}
        className="mx-4 mb-4"
        // Fully functional - not disabled
      />

      <div className="space-y-2">
        <KeywordSuggestions
          suggestions={mockSuggestions}
          onSuggestionClick={handleKeywordClick}
          loading={loading}
          className="px-4"
        />

        <Separator />

        {/* Show similar keywords if there's a current query */}
        {currentQuery.trim() && (
          <>
            <SimilarKeywords
              allKeywords={mockAllKeywords}
              currentQuery={currentQuery}
              onKeywordClick={handleKeywordClick}
              loading={loading}
              maxResults={5}
              threshold={0.3}
              className="px-4"
            />
            <Separator />
          </>
        )}

        <RecentKeywords
          keywords={recentKeywords}
          onKeywordClick={handleKeywordClick}
          loading={loading}
          className="px-4"
        />
      </div>
    </div>
  );
}
