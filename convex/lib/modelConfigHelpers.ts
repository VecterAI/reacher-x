import { env } from "../_generated/server";

export const MODEL_ENVIRONMENT_KEYS = [
  "AI_FAST_MODEL",
  "AI_REASONING_MODEL",
  "AI_AUTOCOMPLETE_MODEL",
  "AI_ONBOARDING_MODEL",
  "AI_SETUP_AGENT_MODEL",
  "AI_MAIN_AGENT_MODEL",
  "AI_VISION_MODEL",
  "AI_TEXT_EMBEDDING_MODEL",
] as const;

export type ModelEnvironmentKey = (typeof MODEL_ENVIRONMENT_KEYS)[number];

export type ModelEnvironment = Partial<
  Record<ModelEnvironmentKey, string | undefined>
>;

export function getConfiguredModel(
  key: ModelEnvironmentKey,
  fallback: string,
  source: ModelEnvironment = env
): string {
  const configuredModel = source[key]?.trim();
  return configuredModel || fallback;
}
