/**
 * Shared Highlighting Utility
 *
 * Reusable text highlighting functionality following React best practices
 * and WCAG 2.1 accessibility guidelines for highlighted content.
 *
 * References:
 * - WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html
 * - React Patterns: https://reactpatterns.com/
 * - Headless UI styling approach: https://headlessui.com/
 */

import React, { useMemo } from "react";

export interface HighlightOptions {
  /**
   * Custom CSS classes for the highlight mark element
   * Default: "rounded bg-neutral-200 px-0.5 dark:bg-neutral-800 dark:text-secondary-foreground"
   */
  highlightClassName?: string;

  /**
   * Whether to make the highlighting case sensitive
   * Default: false
   */
  caseSensitive?: boolean;

  /**
   * Whether to include accessibility attributes
   * Default: true
   */
  includeAria?: boolean;

  /**
   * Custom aria-label for highlighted text
   * Default: "highlighted text: {text}"
   */
  ariaLabel?: string;
}

export interface HighlightResult {
  /**
   * The highlighted text as JSX elements
   */
  highlightedText: React.ReactNode;

  /**
   * Whether any highlighting was applied
   */
  hasHighlights: boolean;

  /**
   * Number of matches found
   */
  matchCount: number;
}

/**
 * Default highlight styling following the existing design system
 */
const DEFAULT_HIGHLIGHT_CLASS =
  "rounded bg-neutral-200 px-0.5 dark:bg-neutral-800 dark:text-secondary-foreground";

/**
 * Escape special regex characters in search query
 * Reference: MDN RegExp guide
 */
function escapeRegexChars(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hook for highlighting text based on a search query
 *
 * @param text - The text to highlight within
 * @param query - The search query to highlight
 * @param options - Highlighting options
 * @returns HighlightResult with JSX elements and metadata
 */
export function useHighlight(
  text: string,
  query: string | null | undefined,
  options: HighlightOptions = {}
): HighlightResult {
  const {
    highlightClassName = DEFAULT_HIGHLIGHT_CLASS,
    caseSensitive = false,
    includeAria = true,
    ariaLabel,
  } = options;

  const result = useMemo((): HighlightResult => {
    // Return original text if no query or empty query
    if (!query?.trim() || !text) {
      return {
        highlightedText: text,
        hasHighlights: false,
        matchCount: 0,
      };
    }

    const trimmedQuery = query.trim();
    const flags = caseSensitive ? "g" : "gi";
    const escapedQuery = escapeRegexChars(trimmedQuery);
    const regex = new RegExp("(" + escapedQuery + ")", flags);

    const parts = text.split(regex);
    let matchCount = 0;

    const highlightedText = parts.map((part, index) => {
      const isMatch = regex.test(part);

      if (isMatch) {
        matchCount++;
        const markProps: React.HTMLAttributes<HTMLElement> = {
          className: highlightClassName,
        };

        // Add accessibility attributes if enabled
        if (includeAria) {
          markProps["aria-label"] = ariaLabel || `highlighted text: ${part}`;
          markProps.role = "mark";
        }

        return React.createElement("mark", { key: index, ...markProps }, part);
      }

      return React.createElement("span", { key: index }, part);
    });

    return {
      highlightedText,
      hasHighlights: matchCount > 0,
      matchCount,
    };
  }, [text, query, highlightClassName, caseSensitive, includeAria, ariaLabel]);

  return result;
}

/**
 * Utility function for simple text highlighting without React hooks
 * Useful for cases where you need the highlighted JSX without component context
 *
 * @param text - The text to highlight within
 * @param query - The search query to highlight
 * @param options - Highlighting options
 * @returns HighlightResult with JSX elements and metadata
 */
export function highlightText(
  text: string,
  query: string | null | undefined,
  options: HighlightOptions = {}
): HighlightResult {
  const {
    highlightClassName = DEFAULT_HIGHLIGHT_CLASS,
    caseSensitive = false,
    includeAria = true,
    ariaLabel,
  } = options;

  // Return original text if no query or empty query
  if (!query?.trim() || !text) {
    return {
      highlightedText: text,
      hasHighlights: false,
      matchCount: 0,
    };
  }

  const trimmedQuery = query.trim();
  const flags = caseSensitive ? "g" : "gi";
  const escapedQuery = escapeRegexChars(trimmedQuery);
  const regex = new RegExp("(" + escapedQuery + ")", flags);

  const parts = text.split(regex);
  let matchCount = 0;

  const highlightedText = parts.map((part, index) => {
    const isMatch = regex.test(part);

    if (isMatch) {
      matchCount++;
      const markProps: React.HTMLAttributes<HTMLElement> = {
        className: highlightClassName,
      };

      // Add accessibility attributes if enabled
      if (includeAria) {
        markProps["aria-label"] = ariaLabel || `highlighted text: ${part}`;
        markProps.role = "mark";
      }

      return React.createElement("mark", { key: index, ...markProps }, part);
    }

    return React.createElement("span", { key: index }, part);
  });

  return {
    highlightedText,
    hasHighlights: matchCount > 0,
    matchCount,
  };
}

/**
 * Recursively highlights keywords in a React node tree.
 * @param node - The React node tree to process
 * @param query - The keyword or phrase to highlight
 * @param options - Highlighting options
 * @returns React node tree with highlights applied
 */
export function highlightInReactTree(
  node: React.ReactNode,
  query: string | null | undefined,
  options: HighlightOptions = {}
): React.ReactNode {
  if (!query?.trim() || !node) return node;
  if (typeof node === "string") {
    // Use highlightText for string nodes
    return highlightText(node, query, options).highlightedText;
  }
  if (Array.isArray(node)) {
    return node.map((child) => highlightInReactTree(child, query, options));
  }
  if (React.isValidElement(node)) {
    // Don't highlight inside <a> tags (preserve links)
    if (node.type === "a") {
      return node;
    }
    // Recursively process children, preserving props type
    type Props = typeof node extends React.ReactElement<infer P> ? P : object;
    const props = node.props as Props;
    if (typeof props === "object" && props !== null) {
      const children =
        "children" in props
          ? (props as { children?: React.ReactNode }).children
          : undefined;
      return React.cloneElement(
        node,
        props,
        highlightInReactTree(children, query, options)
      );
    }
    return node;
  }
  return node;
}

/**
 * Calculate text similarity for keyword matching
 * Uses word overlap algorithm for performance
 *
 * Reference: "Introduction to Information Retrieval" by Manning, Raghavan, and Schütze
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) => text.toLowerCase().trim();
  const s1 = normalize(text1);
  const s2 = normalize(text2);

  if (s1 === s2) return 1.0;

  // Exact substring match gets high score
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Word overlap scoring
  const words1 = s1.split(/\s+/).filter((w) => w.length > 0);
  const words2 = s2.split(/\s+/).filter((w) => w.length > 0);

  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter((word) =>
    words2.some((w2) => w2.includes(word) || word.includes(w2))
  );

  return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Default highlighting options for consistency across components
 */
export const HIGHLIGHT_PRESETS = {
  /**
   * Standard highlighting for keyword lists and suggestions
   */
  KEYWORD: {
    highlightClassName: DEFAULT_HIGHLIGHT_CLASS,
    caseSensitive: false,
    includeAria: true,
  },

  /**
   * Subtle highlighting for secondary content
   */
  SUBTLE: {
    highlightClassName: "rounded bg-neutral-100 px-0.5 dark:bg-neutral-900",
    caseSensitive: false,
    includeAria: true,
  },

  /**
   * Strong highlighting for primary matches
   */
  STRONG: {
    highlightClassName:
      "rounded bg-yellow-200 px-1 dark:bg-yellow-800 dark:text-yellow-100",
    caseSensitive: false,
    includeAria: true,
  },
} as const;
