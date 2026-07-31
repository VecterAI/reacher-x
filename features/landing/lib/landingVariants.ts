/**
 * Landing page iterations available in development via the floating switcher.
 *
 * Workflow:
 * 1. Build a new iteration at `/home/vN` and add it here.
 * 2. When happy, point `/home` at that iteration (keep `/home/vN` archived).
 * 3. Never delete prior `vN` routes — the switcher lists this registry as-is.
 */
export const LANDING_VARIANTS = [
  {
    href: "/home",
    id: "live",
    label: "Live",
    name: "Production",
  },
  {
    href: "/home/v0",
    id: "v0",
    label: "V0",
    name: "Original",
  },
  {
    href: "/home/v2",
    id: "v2",
    label: "V2",
    name: "Two tools",
  },
] as const;

export type LandingVariantId = (typeof LANDING_VARIANTS)[number]["id"];

export function resolveLandingVariantId(
  pathname: string
): LandingVariantId | null {
  const exact = LANDING_VARIANTS.find((variant) => variant.href === pathname);
  if (exact) {
    return exact.id;
  }

  // Longest href first so `/home/v2` wins over `/home`.
  const ranked = LANDING_VARIANTS.toSorted(
    (a, b) => b.href.length - a.href.length
  );
  const prefix = ranked.find(
    (variant) =>
      pathname === variant.href || pathname.startsWith(`${variant.href}/`)
  );
  return prefix?.id ?? null;
}
