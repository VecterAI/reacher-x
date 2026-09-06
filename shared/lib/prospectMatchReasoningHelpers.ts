/** Display the saved explanation, or reuse existing evidence-backed assessment text. */
export function getProspectMatchReasoning(prospect: {
  qualificationReasoning?: string;
  qualificationStatus?: string;
  qualificationCriterionResults?: Array<{
    verdict: string;
    rationale: string;
    sourceIds: string[];
  }>;
}): string | undefined {
  if (prospect.qualificationReasoning?.trim())
    return prospect.qualificationReasoning.trim();
  const rationales = [
    ...new Set(
      (prospect.qualificationCriterionResults ?? [])
        .filter(
          (result) =>
            (result.verdict === "matched" || result.verdict === "partial") &&
            result.sourceIds.length > 0
        )
        .map((result) => result.rationale.trim())
        .filter(Boolean)
    ),
  ].slice(0, 2);
  if (rationales.length) return rationales.join(" ");
  return prospect.qualificationStatus === "qualified"
    ? "A match explanation was not saved for this prospect."
    : undefined;
}
