"use client";

import { useActiveUseCaseLabels } from "@/shared/hooks";
import type { WorkspaceFeatureStatus } from "@/shared/lib/workspaceSystem";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/Badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";

const STATUS_COPY = {
  healthy: "Available",
  degraded: "Limited",
  unavailable: "Unavailable",
  paused: "Paused",
} as const;

const STATUS_DOT_CLASS_NAME = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  unavailable: "bg-destructive",
  paused: "bg-muted-foreground",
} as const;

const ACTIVITY_STATUS_COPY = {
  degraded: "temporarily limited",
  unavailable: "currently unavailable",
  paused: "currently paused",
} as const;

function getWorkspaceFeatureCopy(
  feature: WorkspaceFeatureStatus,
  entitySingular: string,
  entityPlural: string
) {
  const entitySingularLower = entitySingular.toLowerCase();
  const entityPluralLower = entityPlural.toLowerCase();
  const limitedStatus =
    feature.status === "healthy" ? null : ACTIVITY_STATUS_COPY[feature.status];

  switch (feature.key) {
    case "discovery":
      return {
        label: `${entitySingular} discovery`,
        detail: limitedStatus
          ? `Finding new ${entityPluralLower} is ${limitedStatus}.`
          : `△ Agent can find new ${entityPluralLower}.`,
      };
    case "qualification":
      return {
        label: "Match checks",
        detail: limitedStatus
          ? `Scoring ${entityPluralLower} is ${limitedStatus}.`
          : `△ Agent can score ${entityPluralLower}.`,
      };
    case "enrichment":
      return {
        label: "Profile details",
        detail: limitedStatus
          ? `Updating ${entitySingularLower} details is ${limitedStatus}.`
          : `△ Agent can update ${entitySingularLower} details.`,
      };
    case "plan_creation":
      return {
        label: `${entitySingular} plans`,
        detail: limitedStatus
          ? `Creating outreach plans for ${entityPluralLower} is ${limitedStatus}.`
          : `△ Agent can create outreach plans for ${entityPluralLower}.`,
      };
    case "outreach":
      return {
        label: `${entitySingular} outreach`,
        detail: limitedStatus
          ? `Outreach to ${entityPluralLower} is ${limitedStatus}.`
          : `△ Agent can run outreach for ${entityPluralLower}.`,
      };
    case "x_twitter":
    case "linkedin":
      return { label: feature.label, detail: feature.detail };
  }
}

interface WorkspaceFeatureStatusRowProps {
  features: WorkspaceFeatureStatus[];
}

export function WorkspaceFeatureStatusRow({
  features,
}: WorkspaceFeatureStatusRowProps) {
  const { entitySingular, entityPlural } = useActiveUseCaseLabels();

  if (features.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="scroll-fade-x border-border scrollbar-none overflow-x-auto [overflow-y:clip] border-b px-4 py-2.5 [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max list-none items-center gap-1.5 p-0">
          {features.map((feature) => {
            const copy = getWorkspaceFeatureCopy(
              feature,
              entitySingular,
              entityPlural
            );

            return (
              <li key={feature.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      aria-label={`${copy.label}: ${STATUS_COPY[feature.status]}`}
                      className="bg-background h-7 gap-1.5 rounded-sm px-2.5 font-medium"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_DOT_CLASS_NAME[feature.status]
                        )}
                      />
                      {copy.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    <p className="font-medium">
                      {copy.label}: {STATUS_COPY[feature.status]}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {copy.detail}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </div>
    </TooltipProvider>
  );
}
