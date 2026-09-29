/**
 * Renders one plan feature line, emphasizing a leading count ("1,000",
 * "Unlimited") in monospace so plan limits scan at a glance. Shared by the
 * landing pricing page and the in-app plan cards.
 */
const LEADING_COUNT_PATTERN = /^(Unlimited|\d[\d,]*)(\s+)(.+)$/;

export function PlanFeatureLabel({ label }: { label: string }) {
  const match = LEADING_COUNT_PATTERN.exec(label);
  if (!match) return <>{label}</>;
  return (
    <>
      <span className="text-foreground font-mono font-medium tabular-nums">
        {match[1]}
      </span>{" "}
      {match[3]}
    </>
  );
}
