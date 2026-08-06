export const PLANS_PATH = "/plans";
export const PLANS_UPGRADE_PARAM = "upgrade";
export const PLANS_UPGRADE_VALUE = "1" as const;
const CUSTOM_WORKSPACE_LIMIT_EMAIL = "creativecoder.crco@gmail.com";
const CUSTOM_WORKSPACE_LIMIT_SUBJECT = "Request custom workspace limit";

/** Matches `useQueryState("upgrade", parseAsStringLiteral(["1"]))` on the plans page. */
export function getPlansUpgradeHref(): string {
  const params = new URLSearchParams();
  params.set(PLANS_UPGRADE_PARAM, PLANS_UPGRADE_VALUE);
  return `${PLANS_PATH}?${params.toString()}`;
}

/** Contact path for the highest tier, where there is no self-serve upgrade. */
export function getCustomWorkspaceLimitHref(): string {
  return `mailto:${CUSTOM_WORKSPACE_LIMIT_EMAIL}?subject=${encodeURIComponent(CUSTOM_WORKSPACE_LIMIT_SUBJECT)}`;
}
