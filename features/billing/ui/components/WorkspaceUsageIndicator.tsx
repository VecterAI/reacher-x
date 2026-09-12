"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/shared/ui/components/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/components/Popover";
import { Progress } from "@/shared/ui/components/Progress";
import { CloseIcon } from "@/shared/ui/components/icons";
import { WorkspaceUsageRing } from "./WorkspaceUsageRing";
import { getUsageProgress } from "@/shared/lib/planUsagePresentation";
import { getPlansUpgradeHref } from "@/features/billing/lib/plansUpgradeUrl";
import {
  useWorkspacePlanUsage,
  type WorkspacePlanUsage,
} from "./WorkspacePlanUsageProvider";

export function WorkspaceUsageDetails({
  usage,
  unavailable,
  onNavigate,
}: {
  usage: WorkspacePlanUsage | null;
  unavailable: boolean;
  onNavigate: () => void;
}) {
  const progress = usage
    ? getUsageProgress(usage.used ?? 0, usage.limit)
    : null;
  const finiteUsage =
    usage && usage.tier !== "free" && usage.limit > 0 && usage.used !== null;
  return (
    <>
      {usage ? (
        <p className="text-muted-foreground truncate text-xs">
          {usage.workspaceName}
        </p>
      ) : null}
      <div className="space-y-3 py-4">
        {unavailable ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Usage couldn’t load. Open usage to try again.
          </p>
        ) : usage?.tier === "free" ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Choose a plan to keep Agent running.
          </p>
        ) : !usage || usage.used === null ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Usage is being updated.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{usage.entityPlural}</span>
              <span className="tabular-nums">
                <span className="font-medium">
                  {usage.used.toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  {usage.limit === -1
                    ? " used"
                    : ` of ${usage.limit.toLocaleString()}`}
                </span>
              </span>
            </div>
            {finiteUsage && progress ? (
              <Progress
                value={progress.fraction * 100}
                aria-label={`${usage.entityPlural} usage`}
                aria-valuenow={progress.fraction * 100}
                aria-valuetext={`${usage.used} of ${usage.limit} used`}
                className="h-1 rounded-full"
                indicatorClassName="rounded-full transition-none"
              />
            ) : null}
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
              <span
                className={
                  usage.limitReached ? "font-medium" : "text-muted-foreground"
                }
              >
                {usage.limit === -1
                  ? "Unlimited plan"
                  : usage.limitReached
                    ? "Limit reached"
                    : `${progress?.remaining.toLocaleString()} available`}
              </span>
              <span className="text-muted-foreground">
                Resets {format(usage.cycleEnd, "d MMM")}
              </span>
            </div>
            {usage.limitReached ? (
              <p className="text-muted-foreground text-xs text-pretty">
                Agent has paused {usage.discoveryVerb} new{" "}
                {usage.entityPlural.toLowerCase()}.
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="flex gap-2 border-t pt-3">
        {usage && usage.limit !== -1 ? (
          <Button asChild size="xs" className="flex-1">
            <Link href={getPlansUpgradeHref()} onClick={onNavigate}>
              Upgrade plan
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="xs" className="flex-1">
          <Link href="/usage" onClick={onNavigate}>
            View usage
          </Link>
        </Button>
      </div>
    </>
  );
}

export function WorkspaceUsageIndicatorView({
  usage,
  unavailable = false,
}: {
  usage: WorkspacePlanUsage | null;
  unavailable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = unavailable
    ? "Usage unavailable. Open usage to try again"
    : usage?.tier === "free"
      ? "Choose a plan to continue"
      : !usage || usage.used === null
        ? "Usage is being updated"
        : usage.limit === -1
          ? `${usage.used.toLocaleString()} ${usage.entityPlural.toLowerCase()} used. Unlimited plan`
          : `${usage.used.toLocaleString()} of ${usage.limit.toLocaleString()} ${usage.entityPlural.toLowerCase()} used`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xsIcon" aria-label={`Usage. ${label}`}>
          <WorkspaceUsageRing usage={usage} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Workspace usage"
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-1.5rem)] p-4 motion-reduce:animate-none"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-balance">Usage</h2>
          <Button
            variant="ghost"
            size="xsIcon"
            aria-label="Close usage"
            onClick={() => setOpen(false)}
          >
            <CloseIcon className="size-4 fill-current" />
          </Button>
        </div>
        <WorkspaceUsageDetails
          usage={usage}
          unavailable={unavailable}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export function WorkspaceUsageIndicator() {
  const { usage, available, unavailable } = useWorkspacePlanUsage();
  return available ? (
    <li>
      <WorkspaceUsageIndicatorView usage={usage} unavailable={unavailable} />
    </li>
  ) : null;
}
