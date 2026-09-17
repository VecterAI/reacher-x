import type { Doc } from "@/convex/_generated/dataModel";

/** Shared copy for qualification UI (aligned with billing usage and /plans). */
export const QUALIFICATION_UI_LABELS = {
  flaggedRowLabel: "Match result",
  qualified: "Good match",
  disqualified: "Not a match",
  unqualified: "Not a match",
  pending: "Awaiting match check",
  chartTitle: "Match results",
} as const;

export type QualificationPresentation = {
  /** Show qualification chip on prospect cards (qualified / disqualified only). */
  showCardBadge: boolean;
  icon: "match" | "not-match" | "pending";
  /** Tailwind classes for the match-result icon on cards. */
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
      icon: "match",
      cardIconClassName: "text-emerald-600 dark:text-emerald-500",
      cardLabelText: L.qualified,
      profileValueText: L.qualified,
      profileValueClassName: "font-mono text-emerald-600 dark:text-emerald-500",
    };
  }
  if (status === "disqualified") {
    return {
      showCardBadge: true,
      icon: "not-match",
      cardIconClassName: "text-muted-foreground",
      cardLabelText: L.unqualified,
      profileValueText: L.unqualified,
      profileValueClassName: "font-mono text-muted-foreground",
    };
  }
  return {
    showCardBadge: false,
    icon: "pending",
    cardIconClassName: "",
    cardLabelText: "",
    profileValueText: L.pending,
    profileValueClassName: "font-mono text-muted-foreground",
  };
}
