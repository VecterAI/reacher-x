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
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
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
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import type { ProspectPlatform } from "@/shared/ui/components/ProspectPlatformAvatar";
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
import type { ProspectActivityPreviewRecord } from "../../../lib/uiPreviewData";

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
  fallbackDescription: string;
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

function getFallbackDescription(
  type: ActivityType,
  entitySingularLower: string
): string {
  switch (type) {
    case "archived":
      return `This ${entitySingularLower} was archived.`;
    case "plan_created":
      return "An outreach plan was created.";
    case "contacted":
      return "Outreach started.";
    case "posted":
      return "An update was posted.";
    case "responded":
      return "A response was received.";
    case "converted":
      return `This ${entitySingularLower} moved to the next stage.`;
    case "qualified":
      return `This ${entitySingularLower} was evaluated for qualification.`;
    case "enriched":
      return "The profile was enriched.";
    case "found":
    default:
      return `This ${entitySingularLower} was discovered.`;
  }
}

// ============================================================================
// Component
// ============================================================================

export interface ActivityLogTabProps {
  prospectId: string;
  prospectName?: string;
  prospectAvatarUrl?: string;
  prospectPlatform?: ProspectPlatform;
  previewActivities?: ProspectActivityPreviewRecord[];
}

export function ActivityLogTab({
  prospectId,
  prospectName,
  prospectAvatarUrl,
  prospectPlatform,
  previewActivities,
}: ActivityLogTabProps) {
  const { user } = useAuth();
  const { entitySingular, stageLabels } = useActiveUseCaseLabels();
  const [limit, setLimit] = React.useState(ACTIVITIES_PER_PAGE);
  const [loadingLimit, setLoadingLimit] = React.useState<number | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<ActivityFilterType>("all");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const normalizedSearch = debouncedSearch.trim();
  const selectedType = typeFilter === "all" ? undefined : typeFilter;
  const cacheKey = `${selectedType ?? "all"}:${normalizedSearch.toLowerCase()}`;
  const entitySingularLower = entitySingular.toLowerCase();
  const isPreview = Array.isArray(previewActivities);
  const actionLabels = React.useMemo<Record<ActivityType, string>>(
    () => ({
      found: `discovered this ${entitySingularLower}.`,
      qualified: `qualified this ${entitySingularLower}.`,
      enriched: "enriched the profile.",
      plan_created: "created an outreach plan.",
      contacted: "started outreach.",
      posted: "posted an update.",
      responded: "responded.",
      converted: `moved this ${entitySingularLower} to ${stageLabels.converted.toLowerCase()}.`,
      archived: `archived this ${entitySingularLower}.`,
    }),
    [entitySingularLower, stageLabels]
  );
  const activityFilterOptions = React.useMemo(
    (): Array<{ value: ActivityFilterType; label: string }> => [
      { value: "all", label: "All activity" },
      { value: "found", label: "Discovered" },
      { value: "qualified", label: "Qualified" },
      { value: "enriched", label: "Enriched" },
      { value: "plan_created", label: "Plan created" },
      { value: "contacted", label: stageLabels.contacted },
      { value: "posted", label: "Posted update" },
      { value: "responded", label: "Responded" },
      { value: "converted", label: stageLabels.converted },
      { value: "archived", label: stageLabels.archived },
    ],
    [stageLabels]
  );

  const dataQuery = useQueryWithStatus(
    api.outreach.getActivityLog,
    isPreview
      ? "skip"
      : {
          prospectId: prospectId as Id<"prospects">,
          limit,
          type: selectedType,
          search: normalizedSearch || undefined,
        }
  );
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

  const filteredPreviewActivities = React.useMemo(() => {
    if (!previewActivities) {
      return [];
    }

    return previewActivities.filter((activity) => {
      const matchesType = selectedType ? activity.type === selectedType : true;
      if (!matchesType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack =
        `${activity.title} ${activity.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedSearch.toLowerCase());
    });
  }, [normalizedSearch, previewActivities, selectedType]);

  const isLoadingMore =
    !isPreview && loadingLimit !== null && dataQuery.isPending;
  const isInitialLoading =
    !isPreview && dataQuery.isPending && fallbackActivities.length === 0;

  if (isInitialLoading) {
    return <ActivityLogSkeleton />;
  }

  const activities = (
    isPreview
      ? filteredPreviewActivities
      : (data?.activities ?? fallbackActivities)
  ) as ActivityRecord[];
  const hasMore = isPreview ? false : (data?.hasMore ?? fallbackHasMore);
  const hasFilters = typeFilter !== "all" || normalizedSearch.length > 0;

  if (dataQuery.isError && fallbackActivities.length === 0) {
    return (
      <div className="px-4 py-4">
        <ActivityLogFilters
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          options={activityFilterOptions}
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
          options={activityFilterOptions}
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
            ? prospectName || entitySingular
            : "△ Agent",
      action: actionLabels[activityType] || a.title,
      fallbackDescription: getFallbackDescription(
        activityType,
        entitySingularLower
      ),
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
        options={activityFilterOptions}
      />
      {!isPreview && dataQuery.isError && (
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
                  <ProspectPlatformAvatar
                    platform={
                      entry.actorKind === "prospect"
                        ? prospectPlatform
                        : undefined
                    }
                    badgeSize="xs"
                  >
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
                          ? "△"
                          : entry.actorName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </ProspectPlatformAvatar>
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
                  <p>{entry.description || entry.fallbackDescription}</p>
                )}
              </TimelineContent>
              <TimelineDate className="mt-2 mb-0">
                <time dateTime={new Date(entry.timestamp).toISOString()}>
                  ·{" "}
                  {formatRelativeTimeWithTime(
                    new Date(entry.timestamp).toISOString()
                  )}
                </time>
              </TimelineDate>
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
  options,
}: {
  searchInput: string;
  onSearchChange: (value: string) => void;
  typeFilter: ActivityFilterType;
  onTypeFilterChange: (value: ActivityFilterType) => void;
  options: Array<{ value: ActivityFilterType; label: string }>;
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
          {options.map((option) => (
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
