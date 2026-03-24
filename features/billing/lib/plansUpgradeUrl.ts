export const PLANS_PATH = "/plans";
export const PLANS_UPGRADE_PARAM = "upgrade";
export const PLANS_UPGRADE_VALUE = "1" as const;

/** Matches `useQueryState("upgrade", parseAsStringLiteral(["1"]))` on the plans page. */
export function getPlansUpgradeHref(): string {
  const params = new URLSearchParams();
  params.set(PLANS_UPGRADE_PARAM, PLANS_UPGRADE_VALUE);
  return `${PLANS_PATH}?${params.toString()}`;
}
