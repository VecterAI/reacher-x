import type { Doc } from "@/convex/_generated/dataModel";

/** Shared copy for qualification UI (aligned with billing usage and /plans). */
export const QUALIFICATION_UI_LABELS = {
  flaggedRowLabel: "Flagged as",
  qualified: "Qualified",
  unqualified: "Unqualified",
  pending: "Pending",
  chartTitle: "Qualified vs unqualified",
} as const;

export type QualificationPresentation = {
  /** Show qualification chip on prospect cards (qualified / disqualified only). */
  showCardBadge: boolean;
  /** Tailwind classes for Flag2 on cards (icon only). */
  cardIconClassName: string;
  /** Mono label on card chip when badge is shown. */
  cardLabelText: string;
  /** Value text for profile details row. */
  profileValueText: string;
  /** Tailwind for profile value text (icon stays neutral). */
  profileValueClassName: string;
};

/**
 * Maps `qualificationStatus` to UI classes and copy for cards and profile.
 * Card: colored icon only; profile: colored text only.
 */
export function resolveQualificationPresentation(
  status: Doc<"prospects">["qualificationStatus"] | undefined
): QualificationPresentation {
  const L = QUALIFICATION_UI_LABELS;
  if (status === "qualified") {
    return {
      showCardBadge: true,
      cardIconClassName: "text-emerald-600 dark:text-emerald-500",
      cardLabelText: L.qualified,
      profileValueText: L.qualified,
      profileValueClassName: "font-mono text-emerald-600 dark:text-emerald-500",
    };
  }
  if (status === "disqualified") {
    return {
      showCardBadge: true,
      cardIconClassName: "text-orange-600 dark:text-orange-500",
      cardLabelText: L.unqualified,
      profileValueText: L.unqualified,
      profileValueClassName: "font-mono text-orange-600 dark:text-orange-500",
    };
  }
  return {
    showCardBadge: false,
    cardIconClassName: "",
    cardLabelText: "",
    profileValueText: L.pending,
    profileValueClassName: "font-mono text-muted-foreground",
  };
}
