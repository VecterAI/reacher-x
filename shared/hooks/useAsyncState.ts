/**
 * Shared hook utilities for common async state patterns
 */

import { useState, useCallback } from "react";

/**
 * Common async state interface
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Actions for async state management
 */
export interface AsyncActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

/**
 * Combined async state and actions
 */
export interface UseAsyncStateReturn<T> extends AsyncState<T>, AsyncActions {
  setData: (data: T | null) => void;
}

/**
 * Hook for managing common async state patterns
 * @param initialData - Initial data value
 * @returns Async state and actions
 */
export function useAsyncState<T>(
  initialData: T | null = null
): UseAsyncStateReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  return {
    // State
    data,
    loading,
    error,

    // Actions
    setData,
    setLoading,
    setError,
    clearError,
    reset,
  };
}

/**
 * Hook for managing async operations with automatic loading states
 * @param asyncFn - The async function to execute
 * @returns Async state and execute function
 */
export function useAsyncOperation<T, Args extends unknown[]>(
  asyncFn: (...args: Args) => Promise<T>
): UseAsyncStateReturn<T> & {
  execute: (...args: Args) => Promise<T | null>;
} {
  const asyncState = useAsyncState<T>();
  const { setData, setLoading, setError } = asyncState;

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await asyncFn(...args);
        setData(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn, setData, setLoading, setError]
  );

  return {
    ...asyncState,
    execute,
  };
}
