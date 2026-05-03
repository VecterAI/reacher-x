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
  readyTargetCount: 5,
  previewEnrichmentWindow: 8,
  socialQueriesPerCycle: 15,
  twitterSearchBatch: 10,
  maxCyclesPerPreviewRun: 3,
  interCycleDelayMs: 1500,
} as const;
