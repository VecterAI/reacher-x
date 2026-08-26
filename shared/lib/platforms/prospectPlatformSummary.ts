import { PLATFORM_REGISTRY } from "./registry";

interface ProspectPlatformCounts {
  twitterProspectsCount: number;
  linkedInProspectsCount: number;
}

/** Formats the platforms represented by a workspace's discovered prospects. */
export function formatProspectPlatformSummary({
  twitterProspectsCount,
  linkedInProspectsCount,
}: ProspectPlatformCounts): string | null {
  const platformLabels: string[] = [];

  if (twitterProspectsCount > 0) {
    platformLabels.push(PLATFORM_REGISTRY.twitter.label);
  }
  if (linkedInProspectsCount > 0) {
    platformLabels.push(PLATFORM_REGISTRY.linkedin.label);
  }

  return platformLabels.length > 0 ? platformLabels.join(" + ") : null;
}
