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
}

export const SearchInput = memo(
  forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
    {
      onSearch,
      onQueryChange,
      onFocus,
      onBlur,
      onInputStart,
      placeholder = "Type keywords...",
      className,
      defaultValue = "",
      defaultExactMatch = false,
      disabled = false,
      showExactMatch = true,
      autoFocus = false,
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
          e.preventDefault();
          handleSearch();
        }
        // Let parent handle Escape key
      },
      [handleSearch]
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

    return (
      <div className={cn("relative", className)}>
        <Input
          ref={combinedRef}
          size="sm"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(showExactMatch ? "pr-24" : "pr-12")}
          aria-label="Search keywords"
          aria-expanded={false}
          aria-haspopup="listbox"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {showExactMatch && (
            <Toggle
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
            disabled={disabled || !query.trim()}
            aria-label="Search"
            title="Search"
          >
            <SearchIcon className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </div>
    );
  })
);
