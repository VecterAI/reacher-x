/** Display only saved reasoning. Legacy prospects are never hydrated or backfilled. */
export function getProspectMatchReasoning(prospect: {
  qualificationReasoning?: string;
}): string | undefined {
  return prospect.qualificationReasoning?.trim() || undefined;
}
