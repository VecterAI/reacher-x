"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceTransitionState =
  | "idle"
  | "switching_workspace"
  | "redirecting_after_create";

type ActiveWorkspaceTransitionState = Exclude<WorkspaceTransitionState, "idle">;

interface WorkspaceTransitionContextValue {
  state: WorkspaceTransitionState;
  progress: number;
  isTransitioning: boolean;
  startTransition: (state: ActiveWorkspaceTransitionState) => void;
  completeTransition: () => void;
  resetTransition: () => void;
}

const WorkspaceTransitionContext =
  createContext<WorkspaceTransitionContextValue | null>(null);

const PROGRESS_START = 10;
const PROGRESS_MAX_IN_FLIGHT = 92;
const PROGRESS_STEP = 6;
const PROGRESS_TICK_MS = 140;
const COMPLETE_HIDE_DELAY_MS = 220;
const REDIRECT_AUTO_COMPLETE_MS = 2200;

export function WorkspaceTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<WorkspaceTransitionState>("idle");
  const [progress, setProgress] = useState(0);
  const stateRef = useRef<WorkspaceTransitionState>("idle");

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectAutoCompleteTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (redirectAutoCompleteTimerRef.current) {
      clearTimeout(redirectAutoCompleteTimerRef.current);
      redirectAutoCompleteTimerRef.current = null;
    }
  }, []);

  const resetTransition = useCallback(() => {
    clearTimers();
    stateRef.current = "idle";
    setState("idle");
    setProgress(0);
  }, [clearTimers]);

  const completeTransition = useCallback(() => {
    // Use ref-based state to avoid stale-closure issues during async completion.
    if (stateRef.current === "idle") {
      return;
    }

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setProgress(100);
    stateRef.current = "idle";

    hideTimerRef.current = setTimeout(() => {
      setState("idle");
      setProgress(0);
      hideTimerRef.current = null;
    }, COMPLETE_HIDE_DELAY_MS);
  }, []);

  const startTransition = useCallback(
    (nextState: ActiveWorkspaceTransitionState) => {
      clearTimers();
      stateRef.current = nextState;
      setState(nextState);
      setProgress(PROGRESS_START);

      progressTimerRef.current = setInterval(() => {
        setProgress((current) =>
          current >= PROGRESS_MAX_IN_FLIGHT
            ? current
            : Math.min(PROGRESS_MAX_IN_FLIGHT, current + PROGRESS_STEP)
        );
      }, PROGRESS_TICK_MS);
    },
    [clearTimers]
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state !== "redirecting_after_create") {
      return;
    }

    redirectAutoCompleteTimerRef.current = setTimeout(() => {
      completeTransition();
      redirectAutoCompleteTimerRef.current = null;
    }, REDIRECT_AUTO_COMPLETE_MS);

    return () => {
      if (redirectAutoCompleteTimerRef.current) {
        clearTimeout(redirectAutoCompleteTimerRef.current);
        redirectAutoCompleteTimerRef.current = null;
      }
    };
  }, [completeTransition, state]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const value = useMemo(
    () => ({
      state,
      progress,
      isTransitioning: state !== "idle",
      startTransition,
      completeTransition,
      resetTransition,
    }),
    [state, progress, startTransition, completeTransition, resetTransition]
  );

  return (
    <WorkspaceTransitionContext.Provider value={value}>
      {children}
    </WorkspaceTransitionContext.Provider>
  );
}

export function useWorkspaceTransition() {
  const context = useContext(WorkspaceTransitionContext);
  if (!context) {
    throw new Error(
      "useWorkspaceTransition must be used within WorkspaceTransitionProvider."
    );
  }
  return context;
}
