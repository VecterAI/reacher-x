export type LinkedInDataProvider = "treg" | "linkdapi";

type ProviderEnv = Readonly<Record<string, string | undefined>>;

/**
 * Resolve which upstream read/enrichment provider serves LinkedIn queries.
 *
 * Precedence:
 * 1. Explicit `LINKEDIN_DATA_PROVIDER` ("treg" or "linkdapi") always wins.
 * 2. When unset, uses "treg" if `TREG_API_KEY` is configured, else "linkdapi"
 *    so existing deployments keep working without config changes.
 */
export function resolveLinkedInDataProvider(
  env: ProviderEnv = process.env
): LinkedInDataProvider {
  const explicit = env.LINKEDIN_DATA_PROVIDER?.trim().toLowerCase();
  if (explicit === "treg" || explicit === "linkdapi") {
    return explicit;
  }

  return env.TREG_API_KEY?.trim() ? "treg" : "linkdapi";
}

export function isTregLinkedInProvider(
  env: ProviderEnv = process.env
): boolean {
  return resolveLinkedInDataProvider(env) === "treg";
}

/** True when the active LinkedIn read provider has its API key configured. */
export function hasConfiguredLinkedInDataProvider(
  env: ProviderEnv = process.env
): boolean {
  return resolveLinkedInDataProvider(env) === "treg"
    ? Boolean(env.TREG_API_KEY?.trim())
    : Boolean(env.LINKDAPI_API_KEY?.trim());
}
