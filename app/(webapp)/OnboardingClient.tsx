"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import {
  Tour,
  TourContent,
  TourFooter,
  TourOverlay,
  TourStep,
} from "@/shared/ui/components/Tour";
import { getSearchSteps } from "@/features/onboarding/steps";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type TourState = {
  status: "paused" | "done";
  resumeIndex: number;
  updatedAt?: number;
};

const STORAGE_KEY = "rx.tour.v1";

export default function OnboardingClient() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const setTourStateMutation = useMutation(api.users.setTourState);
  const user = useQuery(api.users.getCurrentUser);
  type MaybeUser = { tourState?: Record<string, unknown> } | null;
  const [, setTour] = useQueryState("tour", parseAsString);

  const readLocal = (): TourState | undefined => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      return JSON.parse(raw) as TourState;
    } catch {
      return undefined;
    }
  };

  const normalize = (st?: TourState): TourState | undefined =>
    st
      ? {
          status: st.status,
          resumeIndex: st.resumeIndex ?? 0,
          updatedAt: st.updatedAt ?? 0,
        }
      : undefined;

  const mergedState = useMemo(() => {
    const localState = normalize(readLocal());
    const serverState = normalize(
      (user as MaybeUser)?.tourState?.["v1"] as TourState | undefined
    );
    if (localState && serverState) {
      return (
        localState.updatedAt! >= serverState.updatedAt!
          ? localState
          : serverState
      ) as TourState;
    }
    return (localState ?? serverState) as TourState | undefined;
  }, [user]);

  const shouldStart = useMemo(() => {
    if (pathname !== "/search") return false;
    const flag = params.get("tour");
    const isDone = mergedState?.status === "done";
    if (isDone) return false;
    if (flag === "starter") return true;
    return mergedState ? !isDone : true;
  }, [pathname, params, mergedState]);

  const [isOpen, setOpen] = useState(false);
  const [resumeIndex, setResumeIndex] = useState(0);
  const [awaitResults, setAwaitResults] = useState(false);
  // Track finishing to avoid persisting paused state on close
  const isFinishingRef = useRef(false);

  // Steps definition (mobile-aware for steps 6 & 7)
  const isMobile = useIsMobile();
  const steps = useMemo(() => getSearchSteps(isMobile), [isMobile]);

  // Initialize from merged state
  useEffect(() => {
    if (!shouldStart) return;
    if (mergedState?.status === "done") return;
    setResumeIndex(mergedState?.resumeIndex ?? 0);
    setOpen(true);
  }, [shouldStart, mergedState]);

  // Proactively strip tour param if completed
  useEffect(() => {
    if (pathname !== "/search") return;
    const flag = params.get("tour");
    if (flag && mergedState?.status === "done") {
      void setTour(null, { history: "replace" });
    }
  }, [pathname, params, mergedState, router, setTour]);

  // After first step, pause until results are present
  useEffect(() => {
    if (!isOpen) return;
    if (resumeIndex <= 0) return;
    const gateSelector = "#rx-tour-reply";
    const el = document.querySelector(gateSelector);
    if (el) {
      setAwaitResults(false);
      return;
    }
    setAwaitResults(true);
    const obs = new MutationObserver(() => {
      const found = document.querySelector(gateSelector);
      if (found) {
        setAwaitResults(false);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isOpen, resumeIndex]);

  // When results become available after pausing, re-open the tour automatically
  useEffect(() => {
    if (!shouldStart) return;
    if (resumeIndex > 0 && !awaitResults) {
      setOpen(true);
    }
  }, [awaitResults, resumeIndex, shouldStart]);

  // Persist state changes with updatedAt
  const persist = (partial: Omit<TourState, "updatedAt">) => {
    const state: TourState = { ...partial, updatedAt: Date.now() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    if (isAuthenticated) {
      try {
        void setTourStateMutation({ tour: "v1", state });
      } catch {}
    }
  };

  // Footer labels: follow spec (xs buttons, copy variants)
  const footerLabels = useMemo(
    () => ({ back: "Back", next: "Got it!", finish: "Finish!" }),
    []
  );

  // Close handler is only for intermediate pauses (post step 1). Final completion happens via onFinish.
  const handleClose = () => {
    // Skip pause persistence if we just finished
    if (isFinishingRef.current) {
      isFinishingRef.current = false;
      return;
    }
    if (resumeIndex === 0) {
      const nextIdx = 1;
      setResumeIndex(nextIdx);
      persist({ status: "paused", resumeIndex: nextIdx });
      setAwaitResults(true);
      return;
    }
    persist({ status: "paused", resumeIndex });
  };

  // Explicit finish handler (invoked from the TourFooter on last step)
  const handleFinish = () => {
    isFinishingRef.current = true;
    persist({ status: "done", resumeIndex: 0 });
    setResumeIndex(0);
    setOpen(false);
    void setTour(null, { history: "replace" });
  };

  if (!shouldStart) return null;

  const effectiveOpen = isOpen && !awaitResults;

  return (
    <Tour
      steps={steps}
      isOpen={effectiveOpen}
      onClose={handleClose}
      initialIndex={resumeIndex}
      onIndexChange={(i) => {
        setResumeIndex(i);
        if (!isOpen || isFinishingRef.current) return;
        persist({ status: "paused", resumeIndex: i });
      }}
    >
      <TourOverlay />
      <TourContent>
        <TourStep />
        <TourFooter labels={footerLabels} onFinish={handleFinish} />
      </TourContent>
    </Tour>
  );
}
