import { cn } from "@/shared/lib/utils";
import { getUsageProgress } from "@/shared/lib/planUsagePresentation";
import type { WorkspacePlanUsage } from "./WorkspacePlanUsageProvider";

export function WorkspaceUsageRing({
  usage,
  className,
  strokeWidth = 2,
}: {
  usage: Pick<WorkspacePlanUsage, "used" | "limit"> | null;
  className?: string;
  strokeWidth?: number;
}) {
  const fraction = usage
    ? getUsageProgress(usage.used ?? 0, usage.limit).fraction
    : 0;
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("text-chart-1 size-4 shrink-0", className)}
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted"
      />
      {usage?.limit === -1 ? (
        <text
          x="10"
          y="14"
          textAnchor="middle"
          fill="currentColor"
          fontSize="14"
        >
          ∞
        </text>
      ) : fraction > 0 ? (
        <circle
          cx="10"
          cy="10"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={`${fraction} 1`}
          transform="rotate(-90 10 10)"
          className="workspace-usage-progress"
        />
      ) : null}
    </svg>
  );
}

export function WorkspaceUsagePercentage({
  usage,
}: {
  usage: Pick<WorkspacePlanUsage, "used" | "limit">;
}) {
  if (usage.used === null || usage.limit <= 0) {
    return (
      <WorkspaceUsageRing
        usage={usage}
        className="size-10 sm:size-5 [&_circle]:stroke-1 sm:[&_circle]:stroke-2"
      />
    );
  }
  const percentage = Math.round(
    getUsageProgress(usage.used, usage.limit).fraction * 100
  );
  return (
    <span className="inline-grid size-10 shrink-0 place-items-center sm:size-5">
      <WorkspaceUsageRing
        usage={usage}
        className="col-start-1 row-start-1 size-full [&_circle]:stroke-1 sm:[&_circle]:stroke-2"
      />
      <span className="col-start-1 row-start-1 font-mono text-[10px] leading-none font-medium tabular-nums sm:text-[5.5px]">
        {percentage}%
      </span>
    </span>
  );
}
