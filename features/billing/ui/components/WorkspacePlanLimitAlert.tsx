"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { getPlansUpgradeHref } from "@/features/billing/lib/plansUpgradeUrl";
import {
  useActiveUseCaseLabels,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
} from "@/shared/hooks";
import { getWorkspaceDiscoveryVerb } from "@/shared/lib/workspaceUseCases";
import { cn } from "@/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";

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
  const planQuery = useQueryWithStatus(api.plans.getCurrentPlan);

  const workspaceSystemStatus = shellStateQuery.data?.workspaceSystemStatus;
  const tier = planQuery.data?.tier;
  const requiresPlan = tier === "free";
  const isPlanLimited = workspaceSystemStatus?.issueReason === "limit_reached";

  if (!requiresPlan && !isPlanLimited) {
    return null;
  }

  const entityPluralLower = entityPlural.toLowerCase();
  const discoveryVerb = getWorkspaceDiscoveryVerb(activeUseCaseKey);

  if (requiresPlan) {
    return (
      <Alert className={cn("w-auto", className)}>
        <AlertTitle>Upgrade plan</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {`Choose a plan to keep Agent running for this workspace. Your existing ${entityPluralLower}, settings, and history stay available.`}
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
