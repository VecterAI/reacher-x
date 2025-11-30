// features/search/ui/components/SearchInput.tsx
"use client";

import {
  useState,
  useCallback,
  memo,
  useEffect,
  useRef,
  forwardRef,
} from "react";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import { MatchWordIcon, SearchIcon } from "@/shared/ui/components/icons";
import { Toggle } from "@/shared/ui/components/Toggle";
import { cn } from "@/shared/lib/utils/utils";
import CharacterCounter from "@/shared/ui/components/CharacterCounter";
import {
  QUERY_CHAR_LIMIT,
  computeEffectiveLength,
} from "@/shared/lib/utils/queryLimit";

interface SearchInputProps {
  onSearch?: (query: string, exactMatch: boolean) => void;
  onQueryChange?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onInputStart?: () => void;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  defaultExactMatch?: boolean;
  disabled?: boolean;
  showExactMatch?: boolean;
  autoFocus?: boolean;
  "aria-expanded"?: boolean;
}

export const SearchInput = memo(
  forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
    {
      onSearch,
      onQueryChange,
      onFocus,
      onBlur,
      onInputStart,
      placeholder = "Search...",
      className,
      defaultValue = "",
      defaultExactMatch = false,
      disabled = false,
      showExactMatch = true,
      autoFocus = false,
      "aria-expanded": ariaExpanded,
    },
    ref
  ) {
    const [query, setQuery] = useState(defaultValue);
    const [exactMatch, setExactMatch] = useState(defaultExactMatch);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasStartedTyping = useRef(false);

    // Sync with default values when they change (important for revert functionality)
    useEffect(() => {
      setQuery(defaultValue);
      hasStartedTyping.current = false;
    }, [defaultValue]);

    useEffect(() => {
      setExactMatch(defaultExactMatch);
    }, [defaultExactMatch]);

    // Combine refs
    const combinedRef = useCallback(
      (node: HTMLInputElement) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const handleQueryChange = useCallback(
      (value: string) => {
        setQuery(value);
        onQueryChange?.(value);

        // Trigger input start callback on first keystroke
        if (!hasStartedTyping.current && value !== defaultValue) {
          hasStartedTyping.current = true;
          onInputStart?.();
        }
      },
      [onQueryChange, onInputStart, defaultValue]
    );

    const handleSearch = useCallback(() => {
      if (query.trim()) {
        onSearch?.(query.trim(), exactMatch);
      }
    }, [query, exactMatch, onSearch]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          // Prevent submit when over limit or empty
          const overLimit =
            computeEffectiveLength(query, exactMatch) >= QUERY_CHAR_LIMIT;
          if (overLimit || !query.trim()) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          handleSearch();
        }
        // Let parent handle Escape key
      },
      [handleSearch, query, exactMatch]
    );

    const handleFocus = useCallback(() => {
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      // Small delay to allow for click events on suggestions
      setTimeout(() => {
        onBlur?.();
      }, 150);
    }, [onBlur]);

    const handleToggleExactMatch = useCallback((pressed: boolean) => {
      setExactMatch(pressed);
    }, []);

    // Derived: effective count and limit state
    const effectiveLength = computeEffectiveLength(query, exactMatch);
    const atLimit = effectiveLength >= QUERY_CHAR_LIMIT;

    return (
      <div className={cn("space-y-1", className)}>
        {/* Fixed-height wrapper so overlay stays vertically centered even when error message shows */}
        <div className="relative">
          <Input
            ref={combinedRef}
            size="sm"
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              // Enforce hard cap: block typing/paste beyond limit considering exact-match quotes
              const proposedLength = computeEffectiveLength(next, exactMatch);
              if (proposedLength > QUERY_CHAR_LIMIT) {
                // Soft-trim to fit budget (respecting caret position is not critical here)
                const overBy = proposedLength - QUERY_CHAR_LIMIT;
                const trimmed = next.slice(
                  0,
                  Math.max(0, next.length - overBy)
                );
                handleQueryChange(trimmed);
                return;
              }
              handleQueryChange(next);
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            autoFocus={autoFocus}
            className={cn(showExactMatch ? "pr-36" : "pr-28")}
            aria-label="Search"
            aria-haspopup="listbox"
            aria-expanded={ariaExpanded}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {/* Divider between toggle and counter */}
            <CharacterCounter
              current={effectiveLength}
              max={QUERY_CHAR_LIMIT}
              className={cn("text-xs", atLimit ? "text-red-500" : undefined)}
            />{" "}
            <span className="px-0.5 text-muted-foreground">·</span>
            {showExactMatch && (
              <Toggle
                id="rx-tour-exact-toggle"
                size="xsIcon"
                pressed={exactMatch}
                onPressedChange={handleToggleExactMatch}
                disabled={disabled}
                aria-label={
                  exactMatch
                    ? "Disable exact phrase match"
                    : "Enable exact phrase match"
                }
                title="Toggle exact phrase match"
              >
                <MatchWordIcon className="fill-current" />
              </Toggle>
            )}
            <Button
              type="button"
              size="xsIcon"
              variant="ghost"
              onClick={handleSearch}
              disabled={disabled || !query.trim() || atLimit}
              aria-label="Search"
              title="Search"
            >
              <SearchIcon className="h-4 w-4 fill-current" />
            </Button>
          </div>
        </div>
        {atLimit && (
          <div className="mt-1 text-xs text-red-500">
            Max 512 characters. Please shorten your query.
          </div>
        )}
      </div>
    );
  })
);
