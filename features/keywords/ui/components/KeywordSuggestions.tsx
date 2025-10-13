// features/keywords/ui/components/KeywordSuggestions.tsx
"use client";

import { memo, useMemo } from "react";
import { KeywordList, type KeywordItem } from "./KeywordList";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import AnimatedPercent from "@/shared/ui/components/AnimatedPercent";
import { useKeywordGenProgress } from "@/shared/hooks/useKeywordGenProgress";
import { Skeleton } from "@/shared/ui/components/Skeleton";

interface KeywordSuggestionsProps {
  suggestions: KeywordItem[];
  onSuggestionClick?: (item: KeywordItem) => void;
  className?: string;
  /** Current search query to filter out from suggestions */
  currentQuery?: string;
  /** Optional loading flag for parent components; currently unused internally */
  loading?: boolean;
}

export const KeywordSuggestions = memo<KeywordSuggestionsProps>(
  function KeywordSuggestions({
    suggestions,
    onSuggestionClick,
    className,
    currentQuery = "",
  }) {
    const MAX_DISPLAY = 5;

    // Get search history to exclude keywords that the user has already used.
    const { history } = useSearchHistory();

    const historyKeywordSet = useMemo(
      () => new Set(history.map((item) => item.keyword.toLowerCase())),
      [history]
    );

    // Prefer unseen suggestions; backfill from seen-in-history to keep up to 5 visible
    const finalSuggestions = useMemo(() => {
      const norm = (s: string) => s.toLowerCase().trim();

      const preferred = suggestions.filter((item) => {
        const n = norm(item.keyword);
        if (historyKeywordSet.has(n)) return false;
        return true;
      });
      const fallback = suggestions.filter((item) => {
        const n = norm(item.keyword);
        if (!historyKeywordSet.has(n)) return false;
        return true;
      });

      const out = preferred.slice(0, MAX_DISPLAY);
      if (out.length < MAX_DISPLAY) {
        out.push(...fallback.slice(0, MAX_DISPLAY - out.length));
      }
      return out;
    }, [suggestions, historyKeywordSet]);

    const { value: progress, phase, isComplete } = useKeywordGenProgress();

    // Show skeleton/progress whenever we don't have suggestions yet.
    const hasSuggestions = finalSuggestions.length > 0;
    if (!hasSuggestions) {
      const isGenerating = progress > 0 && !isComplete;
      return (
        <section
          className={className}
          aria-label={
            isGenerating
              ? "Generating keyword suggestions"
              : "Loading keyword suggestions"
          }
          aria-busy="true"
          role="region"
        >
          <dl className="m-0">
            <dt className="mx-3.5 mb-2 text-xs font-medium text-muted-foreground">
              <span className="flex items-baseline gap-1">
                {isGenerating ? (
                  <>
                    Generating keyword suggestions ·
                    <AnimatedPercent
                      value={progress}
                      srLabel="Keyword suggestion generation progress"
                      className="text-xs"
                    />
                    {phase && <span className="sr-only">Phase: {phase}</span>}
                  </>
                ) : (
                  <>Loading keyword suggestions…</>
                )}
              </span>
            </dt>
            <dd className="m-0">
              <div
                className="space-y-2"
                role="status"
                aria-label={
                  isGenerating
                    ? "Generating keyword suggestions"
                    : "Loading keyword suggestions"
                }
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9" aria-hidden="true" />
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
        aria-label={`${finalSuggestions.length} keyword suggestions`}
        role="region"
      >
        <dl className="m-0">
          <dt className="mx-3.5 mb-2 text-xs font-medium text-muted-foreground">
            Try these ↴
          </dt>
          <dd className="m-0">
            <KeywordList
              items={finalSuggestions}
              onKeywordClick={onSuggestionClick}
              listLabel="Suggested keywords"
              highlightQuery={currentQuery}
            />
          </dd>
        </dl>
      </section>
    );
  }
);
