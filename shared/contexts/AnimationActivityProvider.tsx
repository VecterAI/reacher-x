"use client";

import { createContext, useContext, type ReactNode } from "react";

const AnimationActivityContext = createContext(true);

/** Pause decorative updates within an inactive surface; normal app behavior is the default. */
export function AnimationActivityProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <AnimationActivityContext.Provider value={active}>
      {children}
    </AnimationActivityContext.Provider>
  );
}

export function useAnimationActivity() {
  return useContext(AnimationActivityContext);
}
