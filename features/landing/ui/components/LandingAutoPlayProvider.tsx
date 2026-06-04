"use client";

import React from "react";

export type LandingPlayableMediaElement = {
  muted: boolean;
  pause: () => void;
  play: () => Promise<void> | void;
};

type AutoPlayContextValue = {
  setCurrent: (el: LandingPlayableMediaElement | null) => void;
  isCurrent: (el: LandingPlayableMediaElement | null | undefined) => boolean;
};

const AutoPlayContext = React.createContext<AutoPlayContextValue | undefined>(
  undefined
);

export function useLandingAutoPlay() {
  const ctx = React.useContext(AutoPlayContext);
  if (!ctx) throw new Error("useLandingAutoPlay must be used within provider");
  return ctx;
}

export const LandingAutoPlayProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const currentRef = React.useRef<LandingPlayableMediaElement | null>(null);

  const setCurrent = React.useCallback(
    (el: LandingPlayableMediaElement | null) => {
      if (currentRef.current && currentRef.current !== el) {
        try {
          currentRef.current.pause();
        } catch {}
      }
      currentRef.current = el;
    },
    []
  );

  const isCurrent = React.useCallback(
    (el: LandingPlayableMediaElement | null | undefined) => {
      return !!el && currentRef.current === el;
    },
    []
  );

  const value = React.useMemo<AutoPlayContextValue>(
    () => ({ setCurrent, isCurrent }),
    [setCurrent, isCurrent]
  );

  return (
    <AutoPlayContext.Provider value={value}>
      {children}
    </AutoPlayContext.Provider>
  );
};
