"use client";

/**
 * ActivityLogTab
 * Continuous timeline for a prospect's full lifecycle.
 * Merges activity log entries with plan/task data into a single chronological view.
 * Uses Origin UI timeline pattern with avatar-based indicators.
 */

import * as React from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQueryWithStatus } from "@/shared/hooks";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { Input } from "@/shared/ui/components/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineHeader,
  TimelineIndicator,
  TimelineTitle,
  TimelineContent,
  TimelineDate,
} from "@/shared/ui/components/Timeline";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTimeWithTime } from "@/shared/lib/utils/encoding/format";
import { useAuth } from "@/shared/hooks/useAuth";
import { useDebouncedValue } from "@/shared/lib/utils/useDebouncedValue";
import { OutreachPlanCard } from "../outreach-plan";

// ============================================================================
// Types
// ============================================================================

type ActivityType =
  | "found"
  | "qualified"
  | "enriched"
  | "plan_created"
  | "contacted"
  | "posted"
  | "responded"
  | "converted"
  | "archived";

type ActorKind = "user" | "prospect" | "system";
type ActivityFilterType = "all" | ActivityType;

const ACTIVITIES_PER_PAGE = 20;

interface TaskSummary {
  _id: string;
  order: number;
  type: string;
  description: string;
  status: string;
  content?: string;
  targetTweetId?: string;
}

interface PlanSummary {
  planId: string;
  version: number;
  status: string;
  updatedAt: number;
  strategy: {
    rationale: string;
    valueProposition: string;
    tone: string;
    targetTweetId?: string;
  };
  tasks: TaskSummary[];
}

interface ActivityRecord {
  _id: string;
  _creationTime: number;
  type: ActivityType;
  title: string;
  description?: string;
  plan?: PlanSummary | null;
}

interface TimelineEntry {
  id: string;
  actorKind: ActorKind;
  actorName: string;
  action: string;
  description?: string;
  timestamp: number;
  plan?: PlanSummary;
}

// ============================================================================
// Mappings
// ============================================================================

function getActorKind(type: ActivityType): ActorKind {
  switch (type) {
    case "plan_created":
    case "archived":
      return "user";
    case "posted":
    case "responded":
      return "prospect";
    default:
      return "system";
  }
}

const ACTION_LABELS: Record<ActivityType, string> = {
  found: "discovered this prospect.",
  qualified: "qualified this prospect.",
  enriched: "enriched the profile.",
  plan_created: "created an outreach plan.",
  contacted: "started outreach.",
  posted: "posted an update.",
  responded: "responded.",
  converted: "completed outreach.",
  archived: "archived this prospect.",
};

const ACTIVITY_FILTER_OPTIONS: Array<{
  value: ActivityFilterType;
  label: string;
}> = [
  { value: "all", label: "All activity" },
  { value: "found", label: "Discovered" },
  { value: "qualified", label: "Qualified" },
  { value: "enriched", label: "Enriched" },
  { value: "plan_created", label: "Plan created" },
  { value: "contacted", label: "Contacted" },
  { value: "posted", label: "Posted update" },
  { value: "responded", label: "Responded" },
  { value: "converted", label: "Converted" },
  { value: "archived", label: "Archived" },
];

// ============================================================================
// Component
// ============================================================================

export interface ActivityLogTabProps {
  prospectId: string;
  prospectName?: string;
  prospectAvatarUrl?: string;
}

export function ActivityLogTab({
  prospectId,
  prospectName,
  prospectAvatarUrl,
}: ActivityLogTabProps) {
  const { user } = useAuth();
  const [limit, setLimit] = React.useState(ACTIVITIES_PER_PAGE);
  const [loadingLimit, setLoadingLimit] = React.useState<number | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<ActivityFilterType>("all");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const normalizedSearch = debouncedSearch.trim();
  const selectedType = typeFilter === "all" ? undefined : typeFilter;
  const cacheKey = `${selectedType ?? "all"}:${normalizedSearch.toLowerCase()}`;

  const dataQuery = useQueryWithStatus(api.outreach.getActivityLog, {
    prospectId: prospectId as Id<"prospects">,
    limit,
    type: selectedType,
    search: normalizedSearch || undefined,
  });
  const data = dataQuery.data;

  const [cachedActivities, setCachedActivities] = React.useState<
    ActivityRecord[]
  >([]);
  const [cachedHasMore, setCachedHasMore] = React.useState(false);
  const [activeCacheKey, setActiveCacheKey] = React.useState(cacheKey);
  const canUseCache = activeCacheKey === cacheKey;
  const fallbackActivities = canUseCache ? cachedActivities : [];
  const fallbackHasMore = canUseCache ? cachedHasMore : false;

  React.useEffect(() => {
    if (activeCacheKey === cacheKey) return;
    setActiveCacheKey(cacheKey);
    setCachedActivities([]);
    setCachedHasMore(false);
    setLimit(ACTIVITIES_PER_PAGE);
    setLoadingLimit(null);
  }, [activeCacheKey, cacheKey]);

  React.useEffect(() => {
    if (!dataQuery.isSuccess || !data) return;
    setCachedActivities(data.activities as ActivityRecord[]);
    setCachedHasMore(data.hasMore);
  }, [data, dataQuery.isSuccess]);

  const isLoadingMore = loadingLimit !== null && dataQuery.isPending;
  const isInitialLoading =
    dataQuery.isPending && fallbackActivities.length === 0;

  if (isInitialLoading) {
    return <ActivityLogSkeleton />;
  }

  const activities = (data?.activities ??
    fallbackActivities) as ActivityRecord[];
  const hasMore = data?.hasMore ?? fallbackHasMore;
  const hasFilters = typeFilter !== "all" || normalizedSearch.length > 0;

  if (dataQuery.isError && fallbackActivities.length === 0) {
    return (
      <div className="px-4 py-4">
        <ActivityLogFilters
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Could not load activity</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {dataQuery.error.message || "Please try again."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setLoadingLimit(null);
              setLimit(ACTIVITIES_PER_PAGE);
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="px-4 py-4">
        <ActivityLogFilters
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
        <div className="text-muted-foreground py-8 text-center text-sm">
          {hasFilters
            ? "No activity matches your filters."
            : "No activity recorded yet."}
        </div>
      </div>
    );
  }

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || "You"
    : "You";
  const userAvatarUrl = user?.profilePictureUrl ?? undefined;

  // Build timeline entries from activity log
  const entries: TimelineEntry[] = activities.map((a) => {
    const activityType = a.type as ActivityType;
    const actorKind = getActorKind(activityType);

    return {
      id: a._id,
      actorKind,
      actorName:
        actorKind === "user"
          ? userName
          : actorKind === "prospect"
            ? prospectName || "Prospect"
            : "∆ Agent",
      action: ACTION_LABELS[activityType] || a.title,
      description: a.description || undefined,
      timestamp: a._creationTime,
      plan: activityType === "plan_created" ? (a.plan ?? undefined) : undefined,
    };
  });

  // Sort descending (newest first)
  entries.sort((a, b) => b.timestamp - a.timestamp);

  const handleLoadMore = () => {
    const newLimit = limit + ACTIVITIES_PER_PAGE;
    setLoadingLimit(newLimit);
    setLimit(newLimit);
  };

  return (
    <div className="px-4 py-4">
      <ActivityLogFilters
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />
      {dataQuery.isError && (
        <div className="mb-4 rounded-lg border border-dashed px-4 py-3 text-sm">
          <p className="font-medium">Showing last available activity</p>
          <p className="text-muted-foreground mt-1">
            {dataQuery.error.message ||
              "Live activity updates are unavailable."}
          </p>
        </div>
      )}
      <Timeline>
        {entries.map((entry, index) => {
          let avatarUrl: string | undefined;
          switch (entry.actorKind) {
            case "user":
              avatarUrl = userAvatarUrl;
              break;
            case "prospect":
              avatarUrl = prospectAvatarUrl;
              break;
            default:
              avatarUrl = undefined;
              break;
          }

          return (
            <TimelineItem
              className="group-data-[orientation=vertical]/timeline:ms-10 group-data-[orientation=vertical]/timeline:not-last:pb-8"
              key={entry.id}
              step={index + 1}
            >
              <TimelineHeader>
                <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-6.5" />
                <TimelineTitle className="mt-0.5">
                  {entry.actorName}{" "}
                  <span className="text-muted-foreground text-sm font-normal">
                    {entry.action}
                  </span>
                </TimelineTitle>
                <TimelineIndicator className="bg-primary/10 group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-7">
                  <Avatar className="size-6">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={entry.actorName} />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "text-[10px]",
                        entry.actorKind === "system" &&
                          "bg-background text-foreground"
                      )}
                    >
                      {entry.actorKind === "system"
                        ? "∆"
                        : entry.actorName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TimelineIndicator>
              </TimelineHeader>
              <TimelineContent
                className={cn(
                  "text-foreground mt-2 text-sm",
                  entry.plan ? "" : "rounded-lg border px-4 py-3"
                )}
              >
                {entry.plan ? (
                  <OutreachPlanCard
                    variant="history"
                    status={entry.plan.status}
                    rationale={
                      entry.plan.strategy.rationale || entry.description
                    }
                    tasks={entry.plan.tasks}
                  />
                ) : (
                  entry.description && <p>{entry.description}</p>
                )}

                <TimelineDate
                  className={cn("mb-0", entry.plan ? "mt-2" : "mt-1")}
                >
                  <time dateTime={new Date(entry.timestamp).toISOString()}>
                    ·{" "}
                    {formatRelativeTimeWithTime(
                      new Date(entry.timestamp).toISOString()
                    )}
                  </time>
                </TimelineDate>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>

      {hasMore && (
        <div className="pt-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ActivityLogFilters({
  searchInput,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: {
  searchInput: string;
  onSearchChange: (value: string) => void;
  typeFilter: ActivityFilterType;
  onTypeFilterChange: (value: ActivityFilterType) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="search"
        size="sm"
        placeholder="Search activity..."
        value={searchInput}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Select
        value={typeFilter}
        onValueChange={(value) =>
          onTypeFilterChange(value as ActivityFilterType)
        }
      >
        <SelectTrigger size="sm" className="w-full sm:w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTIVITY_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ActivityLogSkeleton() {
  return (
    <div className="space-y-6 px-4 py-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
