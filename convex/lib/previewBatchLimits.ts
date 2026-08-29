function isTruthyEnv(value: string | undefined) {
  return (
    typeof value === "string" &&
    ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
  );
}

export function isSetupPreviewFastPathEnabled() {
  const envValue =
    typeof process !== "undefined"
      ? process.env?.SETUP_PREVIEW_FAST_PATH
      : undefined;
  return isTruthyEnv(envValue);
}

export const PREVIEW_BATCH_LIMITS = {
  readyTargetCount: 3,
  minReadyCount: 1,
  previewEnrichmentWindow: 8,
  socialQueriesPerCycle: 15,
  twitterSearchBatch: 10,
  twitterGraphSeedSearchBatch: 5,
  maxCyclesPerPreviewRun: 3,
  interCycleDelayMs: 1500,
  // Keep searching shortly after the UI moves into the "check back later" state.
  // The 1-hour copy is a user-facing expectation, not a backend sleep timer.
  backgroundRetryDelayMs: 30 * 1000,
  similarProfileSeedLimit: 3,
  similarProfilesPerSeed: 8,
  similarProfileEvidenceProfiles: 6,
  similarProfileEvidencePostsPerProfile: 4,
} as const;
