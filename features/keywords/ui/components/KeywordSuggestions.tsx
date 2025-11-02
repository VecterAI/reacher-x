// features/keywords/ui/components/KeywordSuggestions.tsx
"use client";

import { memo, useMemo } from "react";
import { KeywordList, type KeywordItem } from "./KeywordList";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import { useKeywordGenProgress } from "@/shared/hooks/useKeywordGenProgress";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";

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
    loading = false,
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

    // Phase label mapping for status text
    const getPhaseLabel = (p?: typeof phase): string => {
      switch (p) {
        case "queued":
          return "Queued…";
        case "searching":
          return "Generating suggestions…";
        case "filtering":
          return "Filtering low-signal keywords…";
        case "finalizing":
          return "Finalizing…";
        default:
          return loading ? "Loading suggestions…" : "Generating suggestions…";
      }
    };

    // Show only labels (with ASCII spinner), no skeletons
    const hasSuggestions = finalSuggestions.length > 0;
    if (!hasSuggestions) {
      const isGenerating = progress > 0 && !isComplete;
      if (loading || isGenerating) {
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
                <span className="flex items-baseline gap-2">
                  <AsciiSpinnerText text={getPhaseLabel(phase)} />
                  {phase && <span className="sr-only">Phase: {phase}</span>}
                </span>
              </dt>
              <dd className="m-0" />
            </dl>
          </section>
        );
      }

      // Not loading and no suggestions: render nothing to avoid infinite loader for unauth users
      return null;
    }

    return (
      <section
        className={className}
        aria-label={`${finalSuggestions.length} keyword suggestions`}
        role="region"
      >
        <dl className="m-0">
          <dt className="mx-3.5 mb-2 text-xs font-medium text-muted-foreground">
            Suggestions ↴
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
