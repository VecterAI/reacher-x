/**
 * Custom hook for managing Open Graph previews
 *
 * Provides debounced URL detection, caching, error handling, and loading states
 * for Open Graph preview cards in composer components.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOpenGraph, OpenGraphData } from "../lib/utils/opengraph";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "../lib/utils/urlDetection";
import { openGraphCache } from "../lib/utils/opengraphCache";

export interface UseOgPreviewOptions {
  debounceMs?: number;
  enableCache?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
}

export interface UseOgPreviewResult {
  data: OpenGraphData | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  clearError: () => void;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for managing Open Graph previews with debouncing and caching
 */
export function useOgPreview(
  text: string,
  options: UseOgPreviewOptions = {}
): UseOgPreviewResult {
  const {
    debounceMs = 500,
    enableCache = true,
    retryOnError = true,
    maxRetries = 2,
  } = options;

  const [data, setData] = useState<OpenGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const retryCountRef = useRef(0);
  const lastUrlRef = useRef<string | null>(null);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refetch function
  const refetch = useCallback(async () => {
    if (!lastUrlRef.current) return;

    setError(null);
    setLoading(true);
    setFromCache(false);

    try {
      const result = await fetchOpenGraph(lastUrlRef.current, {
        cache: enableCache,
        retries: retryOnError ? maxRetries : 0,
      });

      if (result.data) {
        setData(result.data);
        setFromCache(result.fromCache || false);
        retryCountRef.current = 0;
      } else {
        setData(null);
        setError(result.error || "Failed to fetch Open Graph data");
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [enableCache, retryOnError, maxRetries]);

  // Main effect for URL detection and fetching
  useEffect(() => {
    // Clear previous debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Note: AbortController is handled within fetchOpenGraph function

    // Reset states
    setData(null);
    setError(null);
    setFromCache(false);

    // Extract URL from text
    const url = getFirstValidUrl(text);

    if (!url) {
      setLoading(false);
      lastUrlRef.current = null;
      return;
    }

    const normalizedUrl = normalizeUrl(url);

    // Check if URL is likely to have Open Graph data
    if (!isLikelyToHaveOpenGraph(normalizedUrl)) {
      setLoading(false);
      lastUrlRef.current = null;
      return;
    }

    // Cache short-circuit: render immediately if cached, skip skeleton
    if (enableCache) {
      const cached = openGraphCache.get(normalizedUrl);
      if (cached !== undefined) {
        lastUrlRef.current = normalizedUrl;
        setData(cached);
        setFromCache(true);
        setLoading(false);
        // Optional: background revalidation without skeleton
        debounceRef.current = setTimeout(async () => {
          try {
            const result = await fetchOpenGraph(normalizedUrl, {
              cache: enableCache,
              retries: retryOnError ? maxRetries : 0,
            });
            if (result.data) {
              setData(result.data);
              setFromCache(!!result.fromCache);
            }
          } catch {
            // ignore revalidation errors
          }
        }, 0);
        return;
      }
    }

    // No cache hit: show skeleton while debounce runs
    setLoading(true);

    // Debounce the fetch operation
    debounceRef.current = setTimeout(async () => {
      // Skip if URL hasn't changed
      if (lastUrlRef.current === normalizedUrl) {
        return;
      }

      lastUrlRef.current = normalizedUrl;
      setLoading(true);
      retryCountRef.current = 0;

      try {
        const result = await fetchOpenGraph(normalizedUrl, {
          cache: enableCache,
          retries: retryOnError ? maxRetries : 0,
        });

        if (result.data) {
          setData(result.data);
          setFromCache(result.fromCache || false);
          retryCountRef.current = 0;
        } else {
          setData(null);

          // Provide more specific error messages based on the error type
          let errorMessage = result.error || "Failed to fetch Open Graph data";

          if (result.error?.includes("timeout")) {
            errorMessage = "The website took too long to respond";
          } else if (result.error?.includes("HTTP 404")) {
            errorMessage = "Page not found - the URL may be broken";
          } else if (result.error?.includes("HTTP 403")) {
            errorMessage = "Access denied - the website blocked our request";
          } else if (result.error?.includes("Network error")) {
            errorMessage = "Network error - please check your connection";
          } else if (result.error?.includes("Invalid URL")) {
            errorMessage = "Invalid URL format";
          }

          setError(errorMessage);

          // Auto-retry on error if enabled (but not for client errors)
          const isRetryableError =
            !result.error?.includes("HTTP 4") &&
            !result.error?.includes("Invalid URL") &&
            !result.error?.includes("Local URLs");

          if (
            retryOnError &&
            isRetryableError &&
            retryCountRef.current < maxRetries
          ) {
            retryCountRef.current++;
            setTimeout(() => {
              if (lastUrlRef.current === normalizedUrl) {
                refetch();
              }
            }, 1000 * retryCountRef.current);
          }
        }
      } catch (err) {
        setData(null);

        // Provide more specific error messages for catch block errors
        let errorMessage = "Unknown error occurred";
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            errorMessage = "Request was cancelled";
          } else if (err.message.includes("fetch")) {
            errorMessage = "Network error - please check your connection";
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);

        // Auto-retry on error if enabled (but not for abort errors)
        const isRetryableError = !(
          err instanceof Error && err.name === "AbortError"
        );

        if (
          retryOnError &&
          isRetryableError &&
          retryCountRef.current < maxRetries
        ) {
          retryCountRef.current++;
          setTimeout(() => {
            if (lastUrlRef.current === normalizedUrl) {
              refetch();
            }
          }, 1000 * retryCountRef.current);
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    // Cleanup function
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [text, debounceMs, enableCache, retryOnError, maxRetries, refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    fromCache,
    clearError,
    refetch,
  };
}
