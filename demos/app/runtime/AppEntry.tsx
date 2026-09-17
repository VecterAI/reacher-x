"use client";

import dynamic from "next/dynamic";

// Local services are browser-owned. Mount the app after hydration instead of
// pretending its authenticated state was resolved by the production server.
export const AppEntry = dynamic(
  () => import("./AppEnvironment").then((module) => module.AppEnvironment),
  { ssr: false }
);
