/**
 * useDebouncedValue
 * Debounces a value by the specified delay.
 * Returns the debounced value that only updates after the delay.
 */
import { useState, useEffect } from "react";

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue((current) =>
        Object.is(current, value) ? current : value
      );
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
