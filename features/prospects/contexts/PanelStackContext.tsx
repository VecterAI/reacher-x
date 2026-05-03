/**
 * Panel Stack Context
 * Manages a stack-based navigation pattern for panels.
 * Closing a sub-panel returns to the previous panel instead of exiting entirely.
 */
"use client";

import * as React from "react";

// Panel types that can be pushed onto the stack
export type PanelType =
  | "prospect-profile"
  | "linkedin-profile"
  | "linkedin-post-thread"
  | "twitter-profile"
  | "evidence-posts"
  | "finance-source"
  | "conversation"
  | "platform-conversation"
  | "post-compose";

export interface PanelEntry {
  type: PanelType;
  props: Record<string, unknown>;
}

interface PanelStackContextValue {
  /** Current panel stack */
  stack: PanelEntry[];
  /** Current (top) panel, null if stack is empty */
  currentPanel: PanelEntry | null;
  /** Push a new panel onto the stack */
  pushPanel: (type: PanelType, props?: Record<string, unknown>) => void;
  /** Pop the current panel, return to previous */
  popPanel: () => void;
  /** Replace the current panel (doesn't add to stack) */
  replacePanel: (type: PanelType, props?: Record<string, unknown>) => void;
  /** Clear entire stack, close all panels */
  clearStack: () => void;
  /** Check if a specific panel type is in the stack */
  hasPanel: (type: PanelType) => boolean;
  /** Get the stack depth */
  depth: number;
}

const PanelStackContext = React.createContext<PanelStackContextValue | null>(
  null
);

export function usePanelStack() {
  const context = React.useContext(PanelStackContext);
  if (!context) {
    throw new Error("usePanelStack must be used within a PanelStackProvider");
  }
  return context;
}

/** Returns panel stack context or null when not within PanelStackProvider */
export function useOptionalPanelStack() {
  return React.useContext(PanelStackContext);
}

export function PanelStackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stack, setStack] = React.useState<PanelEntry[]>([]);

  const currentPanel = React.useMemo(
    () => (stack.length > 0 ? stack[stack.length - 1] : null),
    [stack]
  );

  const pushPanel = React.useCallback(
    (type: PanelType, props: Record<string, unknown> = {}) => {
      setStack((prev) => [...prev, { type, props }]);
    },
    []
  );

  const popPanel = React.useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) {
        // If only one panel or empty, clear the stack
        return [];
      }
      return prev.slice(0, -1);
    });
  }, []);

  const replacePanel = React.useCallback(
    (type: PanelType, props: Record<string, unknown> = {}) => {
      setStack((prev) => {
        if (prev.length === 0) {
          return [{ type, props }];
        }
        return [...prev.slice(0, -1), { type, props }];
      });
    },
    []
  );

  const clearStack = React.useCallback(() => {
    setStack([]);
  }, []);

  const hasPanel = React.useCallback(
    (type: PanelType) => stack.some((entry) => entry.type === type),
    [stack]
  );

  const value = React.useMemo(
    () => ({
      stack,
      currentPanel,
      pushPanel,
      popPanel,
      replacePanel,
      clearStack,
      hasPanel,
      depth: stack.length,
    }),
    [
      stack,
      currentPanel,
      pushPanel,
      popPanel,
      replacePanel,
      clearStack,
      hasPanel,
    ]
  );

  return (
    <PanelStackContext.Provider value={value}>
      {children}
    </PanelStackContext.Provider>
  );
}
