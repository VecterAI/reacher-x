"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { getPlansUpgradeHref } from "@/features/billing/lib/plansUpgradeUrl";
import {
  useActiveUseCaseLabels,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
} from "@/shared/hooks";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import { cn } from "@/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";

const DISCOVERY_VERBS: Record<WorkspaceUseCaseKey, string> = {
  customer_prospecting: "finding",
  recruiting: "sourcing",
  partnership_outreach: "finding",
  investor_outreach: "finding",
  user_research_recruitment: "finding",
  creator_outreach: "finding",
  community_growth: "finding",
  podcast_speaker_sourcing: "finding",
};

interface WorkspacePlanLimitAlertProps {
  className?: string;
}

export function WorkspacePlanLimitAlert({
  className,
}: WorkspacePlanLimitAlertProps) {
  const { activeUseCaseKey, entityPlural } = useActiveUseCaseLabels();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );

  const workspaceSystemStatus = shellStateQuery.data?.workspaceSystemStatus;
  const isPlanLimited = workspaceSystemStatus?.issueReason === "limit_reached";

  if (!isPlanLimited) {
    return null;
  }

  const entityPluralLower = entityPlural.toLowerCase();
  const discoveryVerb = DISCOVERY_VERBS[activeUseCaseKey] ?? "finding";

  return (
    <Alert className={cn("w-auto", className)}>
      <AlertTitle>{`${entityPlural} limit reached`}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {`Your plan limit for qualified ${entityPluralLower} has been reached. The agent has paused ${discoveryVerb} new ${entityPluralLower} for this workspace.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="xs">
            <Link href={getPlansUpgradeHref()}>Upgrade plan</Link>
          </Button>
          <Button asChild size="xs" variant="outline">
            <Link href="/plans">View plans</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
