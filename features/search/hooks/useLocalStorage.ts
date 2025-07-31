// features/search/hooks/useLocalStorage.ts
"use client";

import { useState, useEffect, useCallback } from "react";

// Event name for cross-hook communication within the same window
const STORAGE_CHANGE_EVENT = "onLocalStorageChange";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Function to read from localStorage
  const readStorage = useCallback(() => {
    // This function now runs only on the client
    if (typeof window === "undefined") {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      } else {
        setStoredValue(initialValue);
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      setStoredValue(initialValue);
    }
  }, [key, initialValue]);

  // Read initial value from localStorage
  useEffect(() => {
    readStorage();
    setIsLoaded(true);
    // We only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Listen for changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && event.key === key) {
        console.log(`[useLocalStorage] Storage event received for key: ${key}`);
        readStorage();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, readStorage]);

  // Listen for changes from the same tab (custom event)
  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail.key === key) {
        console.log(
          `[useLocalStorage] Custom storage event received for key: ${key}`
        );
        setStoredValue(event.detail.newValue);
      }
    };
    window.addEventListener(
      STORAGE_CHANGE_EVENT,
      handleCustomEvent as EventListener
    );
    return () =>
      window.removeEventListener(
        STORAGE_CHANGE_EVENT,
        handleCustomEvent as EventListener
      );
  }, [key]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        let newValue: T;
        if (value instanceof Function) {
          // We need to get the current value from state to pass to the updater function
          setStoredValue((current) => {
            newValue = value(current);
            window.localStorage.setItem(key, JSON.stringify(newValue));
            window.dispatchEvent(
              new CustomEvent(STORAGE_CHANGE_EVENT, {
                detail: { key, newValue },
              })
            );
            return newValue;
          });
        } else {
          newValue = value;
          setStoredValue(newValue);
          window.localStorage.setItem(key, JSON.stringify(newValue));
          window.dispatchEvent(
            new CustomEvent(STORAGE_CHANGE_EVENT, {
              detail: { key, newValue },
            })
          );
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  return [storedValue, setValue, isLoaded] as const;
}
